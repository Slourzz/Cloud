use axum::{
    body::Body,
    extract::{Path, State as AxumState},
    http::{header, HeaderMap, Response, StatusCode},
    routing::get,
    Router,
};
use cast_sender::namespace::{Custom, NamespaceUrn};
use cast_sender::{App, AppId, Receiver};
use mdns_sd::{ResolvedService, ServiceDaemon, ServiceEvent};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::net::{IpAddr, UdpSocket};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::ipc::{InvokeBody, Request};
use tauri::State;
use tokio::sync::{Mutex, RwLock};

const CAST_SERVICE_TYPE: &str = "_googlecast._tcp.local.";
const CAST_NAMESPACE: &str = "urn:x-cast:com.cloudapp.player";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CastDevice {
    id: String,
    name: String,
    model: String,
    address: String,
}

struct NativeCastSession {
    receiver: Receiver,
    app: App,
}

#[derive(Clone)]
struct CastMedia {
    token: String,
    mime: String,
    bytes: Arc<Vec<u8>>,
}

#[derive(Clone, Default)]
struct CastMediaStore {
    current: Arc<RwLock<Option<CastMedia>>>,
}

struct CastMediaServer {
    port: u16,
}

pub struct NativeCastState {
    session: Mutex<Option<NativeCastSession>>,
    media: CastMediaStore,
    server: Mutex<Option<CastMediaServer>>,
    local_ip: Mutex<Option<IpAddr>>,
}

impl Default for NativeCastState {
    fn default() -> Self {
        Self {
            session: Mutex::new(None),
            media: CastMediaStore::default(),
            server: Mutex::new(None),
            local_ip: Mutex::new(None),
        }
    }
}

fn property(info: &ResolvedService, key: &str) -> String {
    info.get_property_val_str(key)
        .unwrap_or_default()
        .to_string()
}

fn discover_blocking(timeout: Duration) -> Result<Vec<CastDevice>, String> {
    let daemon = ServiceDaemon::new().map_err(|error| error.to_string())?;
    let receiver = daemon
        .browse(CAST_SERVICE_TYPE)
        .map_err(|error| error.to_string())?;
    let started = Instant::now();
    let mut devices = HashMap::<String, CastDevice>::new();

    while started.elapsed() < timeout {
        let remaining = timeout.saturating_sub(started.elapsed());
        match receiver.recv_timeout(remaining.min(Duration::from_millis(300))) {
            Ok(ServiceEvent::ServiceResolved(info)) => {
                let Some(address) = info.get_addresses_v4().into_iter().next() else {
                    continue;
                };
                let address = address.to_string();
                let id = property(&info, "id");
                let name = property(&info, "fn");
                let model = property(&info, "md");
                let key = if id.is_empty() {
                    address.clone()
                } else {
                    id.clone()
                };

                devices.insert(
                    key.clone(),
                    CastDevice {
                        id: key,
                        name: if name.is_empty() {
                            info.get_fullname()
                                .trim_end_matches(CAST_SERVICE_TYPE)
                                .trim_end_matches('.')
                                .to_string()
                        } else {
                            name
                        },
                        model,
                        address,
                    },
                );
            }
            Ok(_) | Err(_) => {}
        }
    }

    let _ = daemon.stop_browse(CAST_SERVICE_TYPE);
    let _ = daemon.shutdown();

    let mut devices = devices.into_values().collect::<Vec<_>>();
    devices.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(devices)
}

#[tauri::command]
pub async fn discover_cast_devices(timeout_ms: Option<u64>) -> Result<Vec<CastDevice>, String> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(3_500).clamp(1_000, 8_000));
    tauri::async_runtime::spawn_blocking(move || discover_blocking(timeout))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn connect_cast_device(
    state: State<'_, NativeCastState>,
    address: String,
    app_id: String,
) -> Result<(), String> {
    if app_id.trim().is_empty() {
        return Err("Cloud no tiene configurado un App ID de Google Cast.".to_string());
    }

    let mut active_session = state.session.lock().await;
    if let Some(session) = active_session.take() {
        session.receiver.disconnect().await;
    }

    let receiver = Receiver::new();
    receiver
        .connect(&address)
        .await
        .map_err(|error| format!("No se pudo conectar al dispositivo: {error}"))?;

    let receiver_app_id = app_id.trim().to_uppercase();
    let app = receiver
        .launch_app(AppId::Custom(receiver_app_id.clone()))
        .await
        .map_err(|error| {
            let detail = error.to_string();
            if detail.contains("NOT_FOUND") {
                format!(
                    "La TV no tiene autorizado el receptor Cast de Cloud ({receiver_app_id}). \
                     Si la aplicacion aun no esta publicada, registra el numero de serie Cast \
                     de esta TV en Google Cast SDK Developer Console, espera 15 minutos y reinicia la TV."
                )
            } else {
                format!("No se pudo abrir Cloud en la TV: {detail}")
            }
        })?;

    // The Cast channel can be available before the custom receiver has
    // registered its message listener. Give the receiver a brief moment to
    // finish loading before the frontend sends the initial playback state.
    tokio::time::sleep(Duration::from_millis(1_400)).await;

    let local_ip = local_address_for(&address)?;
    *state.local_ip.lock().await = Some(local_ip);
    *active_session = Some(NativeCastSession { receiver, app });
    Ok(())
}

fn local_address_for(remote_address: &str) -> Result<IpAddr, String> {
    let socket = UdpSocket::bind("0.0.0.0:0")
        .map_err(|error| format!("No se pudo preparar el audio para Cast: {error}"))?;
    socket
        .connect((remote_address, 8009))
        .map_err(|error| format!("No se pudo determinar la red de Cast: {error}"))?;
    socket
        .local_addr()
        .map(|address| address.ip())
        .map_err(|error| format!("No se pudo obtener la direccion local: {error}"))
}

fn parse_range(headers: &HeaderMap, total: usize) -> Option<(usize, usize)> {
    let value = headers.get(header::RANGE)?.to_str().ok()?;
    let range = value.strip_prefix("bytes=")?.split(',').next()?;
    let mut bounds = range.splitn(2, '-');
    let start = bounds.next()?.parse::<usize>().ok()?;
    let end = bounds
        .next()
        .filter(|value| !value.is_empty())
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or_else(|| total.saturating_sub(1));

    if start >= total || start > end {
        return None;
    }

    Some((start, end.min(total.saturating_sub(1))))
}

async fn serve_cast_audio(
    AxumState(store): AxumState<CastMediaStore>,
    Path(token): Path<String>,
    headers: HeaderMap,
) -> Response<Body> {
    let media = store.current.read().await.clone();
    let Some(media) = media.filter(|media| media.token == token) else {
        return Response::builder()
            .status(StatusCode::NOT_FOUND)
            .body(Body::empty())
            .unwrap();
    };

    let total = media.bytes.len();
    if total == 0 {
        return Response::builder()
            .status(StatusCode::NO_CONTENT)
            .body(Body::empty())
            .unwrap();
    }

    let requested_range = parse_range(&headers, total);
    let (start, end) = requested_range.unwrap_or((0, total - 1));
    let body = media.bytes[start..=end].to_vec();
    let mut response = Response::builder()
        .status(if requested_range.is_some() {
            StatusCode::PARTIAL_CONTENT
        } else {
            StatusCode::OK
        })
        .header(header::CONTENT_TYPE, media.mime)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::CACHE_CONTROL, "no-store")
        .header(header::CONTENT_LENGTH, body.len().to_string());

    if requested_range.is_some() {
        response = response.header(
            header::CONTENT_RANGE,
            format!("bytes {start}-{end}/{total}"),
        );
    }

    response.body(Body::from(body)).unwrap()
}

async fn ensure_media_server(state: &NativeCastState) -> Result<u16, String> {
    let mut server = state.server.lock().await;
    if let Some(server) = server.as_ref() {
        return Ok(server.port);
    }

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", 0))
        .await
        .map_err(|error| format!("No se pudo abrir el servidor de audio Cast: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("No se pudo leer el puerto Cast: {error}"))?
        .port();
    let app = Router::new()
        .route("/audio/{token}", get(serve_cast_audio))
        .with_state(state.media.clone());

    tauri::async_runtime::spawn(async move {
        if let Err(error) = axum::serve(listener, app).await {
            log::error!("El servidor de audio Cast se detuvo: {error}");
        }
    });
    *server = Some(CastMediaServer { port });
    Ok(port)
}

#[tauri::command]
pub async fn prepare_cast_audio(
    state: State<'_, NativeCastState>,
    request: Request<'_>,
) -> Result<String, String> {
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => bytes.clone(),
        _ => return Err("Cloud no recibio el audio en formato binario.".to_string()),
    };
    if bytes.is_empty() {
        return Err("La cancion no contiene audio para transmitir.".to_string());
    }

    let mime = request
        .headers()
        .get("x-cloud-audio-mime")
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.is_empty())
        .unwrap_or("audio/mpeg")
        .to_string();
    let token = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos()
        .to_string();

    *state.media.current.write().await = Some(CastMedia {
        token: token.clone(),
        mime,
        bytes: Arc::new(bytes),
    });

    let port = ensure_media_server(&state).await?;
    let local_ip = state
        .local_ip
        .lock()
        .await
        .ok_or_else(|| "Conecta primero un dispositivo Cast.".to_string())?;
    Ok(format!("http://{local_ip}:{port}/audio/{token}"))
}

#[tauri::command]
pub async fn send_cast_message(
    state: State<'_, NativeCastState>,
    payload: Value,
) -> Result<(), String> {
    let active_session = state.session.lock().await;
    let session = active_session
        .as_ref()
        .ok_or_else(|| "No hay una sesion Cast activa.".to_string())?;
    let fields = payload
        .as_object()
        .cloned()
        .ok_or_else(|| "El mensaje Cast no es valido.".to_string())?
        .into_iter()
        .collect::<HashMap<_, _>>();

    session
        .receiver
        .send(
            &session.app,
            Custom {
                namespace: NamespaceUrn::Custom(CAST_NAMESPACE.to_string()),
                fields,
            },
        )
        .await
        .map_err(|error| format!("La pantalla Cast dejo de responder: {error}"))
}

#[tauri::command]
pub async fn disconnect_cast_device(state: State<'_, NativeCastState>) -> Result<(), String> {
    if let Some(session) = state.session.lock().await.take() {
        let _ = session.receiver.stop_app(&session.app).await;
        session.receiver.disconnect().await;
    }
    *state.media.current.write().await = None;
    *state.local_ip.lock().await = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires a Cast device on the local network"]
    fn discovers_devices_on_local_network() {
        let devices = discover_blocking(Duration::from_secs(4)).unwrap();
        println!("Cast devices found: {devices:#?}");
    }

    #[test]
    fn preserves_cloud_message_type() {
        let payload = serde_json::json!({
            "type": "cloud-state",
            "song": { "title": "Cloud" }
        });
        let fields = payload
            .as_object()
            .unwrap()
            .clone()
            .into_iter()
            .collect::<HashMap<_, _>>();
        let serialized = serde_json::to_value(Custom {
            namespace: NamespaceUrn::Custom(CAST_NAMESPACE.to_string()),
            fields,
        })
        .unwrap();

        assert_eq!(serialized["type"], "cloud-state");
    }
}
