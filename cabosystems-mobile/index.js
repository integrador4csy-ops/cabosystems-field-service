// Punto de entrada global de la aplicación (Headless JS + UI)
// Es CRUCIAL que liveTrackingService se importe aquí para que TaskManager.defineTask
// se registre tanto en primer plano como en ejecuciones en segundo plano (pantalla bloqueada / app cerrada).
import './lib/liveTrackingService';
import 'expo-router/entry';
