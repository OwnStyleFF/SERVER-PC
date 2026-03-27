# Taecel API Field Mapping (RequestTXN, StatusTXN, getProducts)

Este documento consolida el comportamiento aplicado en el proyecto y refleja la documentación oficial de Taecel API (`https://app.taecel.com/api/doc`).

---

## 1) RequestTXN (https://app.taecel.com/api/doc/RequestTXN)

### Campos obligatorios según API
- `key` (desde env TAECEL_KEY)
- `nip` (desde env TAECEL_NIP)
- `funcion=requestTXN`
- `producto` (código de producto Taecel, ej. `TEL010`, no etiqueta con precio)
- `monto` (valor numérico)
- `numeroRecarga` (teléfono destino 10 dígitos)
- `referencia` (referencia de la transacción)

### Campos auxiliares recomendados y/o permitidos
- `numero` (duplicado del número de recarga, para compatibilidad histórica)
- `numeroReferencia` (misma información, para variantes de API)
- `idOperador` (ID del operador, si está disponible)
- `operador` (nombre del operador, si está disponible)

### Normalización aplicada
- Quitar `+52`, `52` y `1` inicial en números mexicanos.
- Mantener solo los últimos 10 dígitos (`2423190001` etc).
- Payload final en frontend:
  - `producto`: `finalProductCode`
  - `referencia`: user o `ORD-${Date.now()}`
  - `monto`: amount
  - `numero`, `numeroRecarga`, `numeroReferencia`: número normalizado

---

## 2) StatusTXN (https://app.taecel.com/api/doc/StatusTXN)

### Payload
- `key`
- `nip`
- `funcion=StatusTXN`
- `transid` (ID de transacción devuelto por RequestTXN)

### Retorno
- Estructura JSON de estado de transacción para leer `data` y `status`.

---

## 3) getProducts (https://app.taecel.com/api/doc/getProducts)

### Payload
- `key`
- `nip`
- `funcion=getProducts`

### Uso
- Se usa para cargar catálogo en UI. Mapa de productos, precio, ID.
- En el proyecto se almacena en: `taecelCatalog` y’usage para selección de producto.

---

## 4) Pipeline de ejecución

1. `getProducts` carga catálogo.
2. Usuario selecciona proveedor + denom.
3. La UI genera `payload` para `RequestTXN` (con campos necesarios y mínimos).
4. Backend `callTaecelApi('RequestTXN', payload)` valida y reenvía (directo a `https://app.taecel.com/api/RequestTXN`, fallback a wrapper PHP).
5. Si `success` true => guarda y consultar `StatusTXN` con `transid`.

---

## 5) Dejar agregado en codebase

- `src/App.tsx`: lógica de `producto` + número válido + construir payload
- `server.ts`: filtro `allowedFieldsByEndpoint` + `normalizeRequestParams`
- `TaecelREST.php`: `RequestTXN` con `numeroRecarga`, `numeroReferencia`, `numero`
- `docs/taecel-fields.md`: referencia para mantenibilidad
