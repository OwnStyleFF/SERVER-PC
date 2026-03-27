# PC Controller (Agente de Renta)

Este módulo es un agente para ejecutar en PCs de renta, con funciones:

- Conexion con servidor central (ping/heartbeat, commands).
- Bloqueo de pantalla en modo kiosk al terminar tiempo.
- Desbloqueo cuando se renueva renta o cancela.
- Control de reintentos y proceso oculto.

## Instalación

1. Copiar carpeta `pc-controller` a la PC de cliente.
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Ajustar `serverUrl` y `pcId` en `electron-store` (primera ejecución) o en .env.

## Ejecutar

```bash
npm start
```

Para packaging en Windows:

```bash
npm run build
```

## Comportamiento de bloqueo

- El agente consulta `/api/pc/{pcId}/heartbeat` cada 5s.
- Si devuelve `action: 'lock'`, se abre `lock-screen.html` en `kiosk` fullscreen.
- Si devuelve `action: 'unlock'`, se cierra esa ventana.

## Recomendaciones de seguridad

- Publicar como servicio de Windows (ej: `nssm` o `node-windows`).
- Agregar autorización en servidor para solo aceptar PCs registradas.
- Proteger la ruta local para evitar finalizar la app.
