use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use sysinfo::Disks;
use tauri::Manager;
use tauri_plugin_deep_link::DeepLinkExt;
use urlencoding;

mod native_cast;
use native_cast::NativeCastState;

// ---------- Estructuras para iTunes ----------
#[derive(Serialize, Deserialize, Clone)]
struct AlbumInfo {
    id: String,
    name: String,
    release_date: String,
    image_url: Option<String>,
    total_tracks: Option<u32>,
    collection_type: Option<String>,
}

#[derive(Deserialize)]
struct ItunesSearchResponse {
    results: Vec<ItunesAlbumItem>,
}

#[derive(Deserialize)]
struct ItunesAlbumItem {
    #[serde(rename = "collectionId")]
    collection_id: u64,
    #[serde(rename = "collectionName")]
    collection_name: String,
    #[serde(rename = "releaseDate")]
    release_date: String,
    #[serde(rename = "artworkUrl100")]
    artwork_url100: Option<String>,
    #[serde(rename = "trackCount")]
    track_count: Option<u32>,
}

// ---------- Estructuras para Wikidata ----------
#[derive(Deserialize)]
struct WikidataSearchResponse {
    search: Vec<WikidataEntity>,
}

#[derive(Deserialize)]
struct WikidataEntity {
    id: String,
    label: Option<String>,
}

#[derive(Deserialize)]
struct WikidataEntityDetail {
    entities: std::collections::HashMap<String, EntityData>,
}

#[derive(Deserialize)]
struct EntityData {
    claims: Option<std::collections::HashMap<String, Vec<Claim>>>,
}

#[derive(Deserialize)]
struct Claim {
    mainsnak: Option<MainSnak>,
}

#[derive(Deserialize)]
struct MainSnak {
    datavalue: Option<DataValue>,
}

#[derive(Deserialize)]
struct DataValue {
    value: serde_json::Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemStatus {
    platform: String,
    os_name: String,
    os_version: String,
    architecture: String,
    app_version: String,
    native_cache_bytes: u64,
    disk_total_bytes: u64,
    disk_available_bytes: u64,
}

// ---------- Estructuras para Discogs ----------
#[derive(Deserialize)]
struct DiscogsSearchResponse {
    results: Vec<DiscogsResult>,
}

#[derive(Deserialize)]
struct DiscogsResult {
    thumb: Option<String>,
    cover_image: Option<String>,
}

// ---------- Comandos de artista ----------

#[tauri::command]
async fn fetch_artist_albums(artist: String) -> Result<Vec<AlbumInfo>, String> {
    let url = format!(
        "https://itunes.apple.com/search?term={}&entity=album&limit=30",
        urlencoding::encode(&artist)
    );
    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let results = data["results"].as_array().ok_or("No results")?;

    let mut albums: Vec<AlbumInfo> = results
        .iter()
        .map(|item| AlbumInfo {
            id: item["collectionId"]
                .as_u64()
                .map(|v| v.to_string())
                .unwrap_or_default(),
            name: item["collectionName"].as_str().unwrap_or("").to_string(),
            release_date: item["releaseDate"].as_str().unwrap_or("").to_string(),
            image_url: item["artworkUrl100"]
                .as_str()
                .map(|url| url.replace("100x100bb", "600x600bb")),
            total_tracks: item["trackCount"].as_u64().map(|t| t as u32),
            collection_type: item["collectionType"].as_str().map(|s| s.to_string()),
        })
        .collect();

    albums.sort_by(|a, b| b.release_date.cmp(&a.release_date));
    Ok(albums)
}

#[tauri::command]
async fn fetch_artist_bio(artist: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let search_url = format!(
        "https://www.wikidata.org/w/api.php?action=wbsearchentities&search={}&language=es&format=json&limit=1",
        urlencoding::encode(&artist)
    );
    let search_response = client
        .get(&search_url)
        .header("User-Agent", "CloudMusicPlayer/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let search_data: WikidataSearchResponse =
        search_response.json().await.map_err(|e| e.to_string())?;
    let entity = search_data.search.into_iter().next().ok_or("No entity")?;

    let wikipedia_url = format!(
        "https://es.wikipedia.org/api/rest_v1/page/summary/{}",
        urlencoding::encode(&entity.label.unwrap_or_else(|| artist.clone()))
    );
    let wiki_response = client
        .get(&wikipedia_url)
        .header("User-Agent", "CloudMusicPlayer/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if wiki_response.status().is_success() {
        let wiki_data: serde_json::Value = wiki_response.json().await.map_err(|e| e.to_string())?;
        let extract = wiki_data["extract"]
            .as_str()
            .unwrap_or("Biografía no disponible");
        Ok(extract.to_string())
    } else {
        Err("No se pudo obtener la biografía".into())
    }
}

#[tauri::command]
async fn fetch_artist_image(artist: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    if let Ok(img) = fetch_deezer_image(&client, &artist).await {
        return Ok(img);
    }
    if let Ok(img) = fetch_wikidata_image(&client, &artist).await {
        return Ok(img);
    }
    if let Ok(img) = fetch_wikipedia_image(&client, &artist).await {
        return Ok(img);
    }
    if let Ok(img) = fetch_discogs_image(&client, &artist).await {
        return Ok(img);
    }
    if let Ok(img) = fetch_theaudiodb_image(&client, &artist).await {
        return Ok(img);
    }
    if let Ok(img) = fetch_itunes_artist_image(&client, &artist).await {
        return Ok(img);
    }
    Err("No se encontró imagen".into())
}

async fn fetch_deezer_image(client: &Client, artist: &str) -> Result<String, String> {
    let url = format!(
        "https://api.deezer.com/search/artist?q={}&limit=1",
        urlencoding::encode(artist)
    );
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let first = data["data"][0].as_object().ok_or("No artist")?;
    let img = first
        .get("picture_big")
        .or_else(|| first.get("picture_medium"))
        .and_then(|v| v.as_str())
        .ok_or("No image")?;
    if img.contains("deezer.com/img/artist") {
        return Err("Placeholder".into());
    }
    Ok(img.to_string())
}

async fn fetch_wikidata_image(client: &Client, artist: &str) -> Result<String, String> {
    let search_url = format!("https://www.wikidata.org/w/api.php?action=wbsearchentities&search={}&language=es&format=json&limit=1", urlencoding::encode(artist));
    let search_response = client
        .get(&search_url)
        .header("User-Agent", "CloudMusicPlayer/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let search_data: WikidataSearchResponse =
        search_response.json().await.map_err(|e| e.to_string())?;
    let entity = search_data.search.into_iter().next().ok_or("No entity")?;
    let detail_url = format!(
        "https://www.wikidata.org/wiki/Special:EntityData/{}.json",
        entity.id
    );
    let detail_response = client
        .get(&detail_url)
        .header("User-Agent", "CloudMusicPlayer/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let detail_data: WikidataEntityDetail =
        detail_response.json().await.map_err(|e| e.to_string())?;
    let entity_details = detail_data.entities.get(&entity.id).ok_or("No details")?;
    let claims = entity_details.claims.as_ref().ok_or("No claims")?;
    let image_claims = claims.get("P18").ok_or("No P18")?;
    let claim = image_claims.first().ok_or("No claim")?;
    let mainsnak = claim.mainsnak.as_ref().ok_or("No mainsnak")?;
    let datavalue = mainsnak.datavalue.as_ref().ok_or("No datavalue")?;
    let image_name = datavalue.value.as_str().ok_or("No value")?;
    let encoded_name = image_name.replace(" ", "_");
    let url = format!(
        "https://commons.wikimedia.org/wiki/Special:FilePath/{}?width=600",
        urlencoding::encode(&encoded_name)
    );
    Ok(url)
}

async fn fetch_wikipedia_image(client: &Client, artist: &str) -> Result<String, String> {
    let url = format!(
        "https://es.wikipedia.org/api/rest_v1/page/summary/{}",
        urlencoding::encode(artist)
    );
    let response = client
        .get(&url)
        .header("User-Agent", "CloudMusicPlayer/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err("Page not found".into());
    }
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let img = data["thumbnail"]["source"].as_str().ok_or("No thumbnail")?;
    Ok(img.to_string())
}

async fn fetch_discogs_image(client: &Client, artist: &str) -> Result<String, String> {
    let url = format!(
        "https://api.discogs.com/search?q={}&type=artist&per_page=1",
        urlencoding::encode(artist)
    );
    let response = client
        .get(&url)
        .header("User-Agent", "CloudMusicPlayer/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err("Discogs error".into());
    }
    let data: DiscogsSearchResponse = response.json().await.map_err(|e| e.to_string())?;
    let artist_data = data.results.into_iter().next().ok_or("No artist")?;
    let img = artist_data
        .cover_image
        .or(artist_data.thumb)
        .ok_or("No image")?;
    Ok(img)
}

async fn fetch_theaudiodb_image(client: &Client, artist: &str) -> Result<String, String> {
    let url = format!(
        "https://www.theaudiodb.com/api/v1/json/1/search.php?s={}",
        urlencoding::encode(artist)
    );
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let artists = data["artists"].as_array().ok_or("No artists")?;
    let artist_data = artists.first().ok_or("No artist data")?;
    if let Some(img) = artist_data["strArtistThumb"].as_str() {
        if !img.is_empty() {
            return Ok(img.to_string());
        }
    }
    if let Some(img) = artist_data["strArtistFanart"].as_str() {
        if !img.is_empty() {
            return Ok(img.to_string());
        }
    }
    Err("No image".into())
}

async fn fetch_itunes_artist_image(client: &Client, artist: &str) -> Result<String, String> {
    let url = format!(
        "https://itunes.apple.com/search?term={}&entity=album&limit=1",
        urlencoding::encode(artist)
    );
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let results = data["results"].as_array().ok_or("No results")?;
    let album = results.first().ok_or("No album")?;
    let artwork = album["artworkUrl100"].as_str().ok_or("No artwork")?;
    Ok(artwork.replace("100x100bb", "600x600bb"))
}

// ---------- Caché en disco ----------
fn get_image_cache_dir() -> PathBuf {
    let mut dir = dirs_next::cache_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("CloudMusicPlayer");
    dir.push("artist_images");
    dir
}

fn get_app_cache_dir() -> PathBuf {
    let mut dir = dirs_next::cache_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("CloudMusicPlayer");
    dir
}

fn directory_size(path: &std::path::Path) -> u64 {
    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };

    entries
        .filter_map(Result::ok)
        .map(|entry| {
            let path = entry.path();
            if path.is_dir() {
                directory_size(&path)
            } else {
                entry.metadata().map(|metadata| metadata.len()).unwrap_or(0)
            }
        })
        .sum()
}

#[tauri::command]
fn get_system_status(app: tauri::AppHandle) -> SystemStatus {
    let cache_dir = get_app_cache_dir();
    let disks = Disks::new_with_refreshed_list();
    let active_disk = disks
        .list()
        .iter()
        .filter(|disk| cache_dir.starts_with(disk.mount_point()))
        .max_by_key(|disk| disk.mount_point().as_os_str().len())
        .or_else(|| disks.list().first());

    SystemStatus {
        platform: std::env::consts::OS.to_string(),
        os_name: sysinfo::System::name().unwrap_or_else(|| "Windows".to_string()),
        os_version: sysinfo::System::os_version().unwrap_or_else(|| "Desconocida".to_string()),
        architecture: std::env::consts::ARCH.to_string(),
        app_version: app.package_info().version.to_string(),
        native_cache_bytes: directory_size(&cache_dir),
        disk_total_bytes: active_disk.map(|disk| disk.total_space()).unwrap_or(0),
        disk_available_bytes: active_disk.map(|disk| disk.available_space()).unwrap_or(0),
    }
}

#[tauri::command]
fn clear_app_cache() -> Result<u64, String> {
    let cache_dir = get_app_cache_dir();
    let bytes_removed = directory_size(&cache_dir);

    if cache_dir.exists() {
        fs::remove_dir_all(&cache_dir).map_err(|error| error.to_string())?;
    }

    fs::create_dir_all(&cache_dir).map_err(|error| error.to_string())?;
    Ok(bytes_removed)
}

#[tauri::command]
fn cache_artist_image(artist: String, image_url: String) -> Result<(), String> {
    let cache_dir = get_image_cache_dir();
    fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    let file_name = format!("{}.url", urlencoding::encode(&artist));
    let file_path = cache_dir.join(file_name);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let content = format!("{}\n{}", image_url, now);
    fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_cached_artist_image(artist: String) -> Result<String, String> {
    let cache_dir = get_image_cache_dir();
    let file_name = format!("{}.url", urlencoding::encode(&artist));
    let file_path = cache_dir.join(file_name);
    if !file_path.exists() {
        return Err("No cached".into());
    }
    let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let lines: Vec<&str> = content.lines().collect();
    if lines.len() < 2 {
        return Err("Invalid format".into());
    }
    let image_url = lines[0].to_string();
    let cached_at: u64 = lines[1].parse().unwrap_or(0);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    if now - cached_at > 2592000 {
        let _ = fs::remove_file(&file_path);
        return Err("Expired".into());
    }
    Ok(image_url)
}

// ---------- Descarga de imagen temporal ----------
#[tauri::command]
async fn download_image_to_temp(url: String) -> Result<String, String> {
    let client = Client::new();
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    let temp_dir = dirs_next::cache_dir().unwrap_or_else(|| PathBuf::from("."));
    let cover_dir = temp_dir.join("CloudMusicPlayer").join("covers");
    fs::create_dir_all(&cover_dir).map_err(|e| e.to_string())?;

    let filename = format!(
        "cover_{}.jpg",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
    );
    let file_path = cover_dir.join(&filename);
    let mut file = fs::File::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    Ok(file_path.to_string_lossy().to_string())
}

// ---------- Comando para fullscreen nativo (soluciona bug maximizado + F11) ----------
#[tauri::command]
fn enter_fullscreen(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())?;
        // Bloquear el hilo nativo de la ventana para que Windows procese los mensajes
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
    window.set_fullscreen(true).map_err(|e| e.to_string())?;
    Ok(())
}

fn focus_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// ---------- Punto de entrada ----------
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Forzar el AppUserModelID para que Windows muestre "Cloud" y el logo correcto
    #[cfg(target_os = "windows")]
    unsafe {
        windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID(windows::core::w!(
            "com.cloudapp.slourzz"
        ))
        .ok();
    }

    tauri::Builder::default()
        .manage(NativeCastState::default())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            focus_main_window(app);
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            fetch_artist_albums,
            fetch_artist_bio,
            fetch_artist_image,
            cache_artist_image,
            get_cached_artist_image,
            download_image_to_temp,
            get_system_status,
            native_cast::discover_cast_devices,
            native_cast::connect_cast_device,
            native_cast::prepare_cast_audio,
            native_cast::load_cast_audio,
            native_cast::set_cast_playback,
            native_cast::send_cast_message,
            native_cast::disconnect_cast_device,
            clear_app_cache,
            enter_fullscreen // ← NUEVO COMANDO
        ])
        .setup(|app| {
            app.deep_link().register_all()?;

            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |_event| {
                focus_main_window(&app_handle);
            });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
