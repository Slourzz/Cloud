use cast_sender::namespace::{Custom, NamespaceUrn};
use cast_sender::{App, AppId, Receiver};
use mdns_sd::{ResolvedService, ServiceDaemon, ServiceEvent};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tauri::State;
use tokio::sync::Mutex;

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

#[derive(Default)]
pub struct NativeCastState {
    session: Mutex<Option<NativeCastSession>>,
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

    let app = receiver
        .launch_app(AppId::Custom(app_id))
        .await
        .map_err(|error| format!("No se pudo abrir Cloud en la TV: {error}"))?;

    *active_session = Some(NativeCastSession { receiver, app });
    Ok(())
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
