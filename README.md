# LogiRed · Encuesta a tiendas

Formulario para validar el MVP de LogiRed con tiendas del casco urbano de Puerto Ayacucho. Quien entrevista lo llena desde el teléfono mientras conversa con el dueño de cada tienda. Las respuestas se guardan en una hoja de Google Sheets.

- **Funciona sin señal:** cada respuesta se guarda primero en el teléfono y se envía sola cuando vuelve la conexión.
- **Resultados en la misma página:** promedios, porcentajes y la lista de tiendas, protegidos con una clave porque incluyen teléfonos.
- **Sin duplicados:** si un envío se reintenta, la hoja no repite la fila.

## Cómo funciona

```
Teléfono (public/index.html)
   │  guarda en el teléfono si no hay señal
   ▼
Vercel  /api/respuestas  (api/respuestas.js)
   │  añade la clave secreta; la URL del script nunca llega al navegador
   ▼
Google Apps Script  (apps-script/Code.gs)
   ▼
Hoja de Google Sheets, pestaña "Respuestas"
```

## Configuración (unos 15 minutos)

### 1. Crear la hoja y el script

1. Crea una hoja nueva en Google Sheets, por ejemplo **LogiRed – Encuesta tiendas**.
2. En la hoja, abre **Extensiones → Apps Script**.
3. Borra el contenido de `Código.gs` y pega todo el contenido de [`apps-script/Code.gs`](apps-script/Code.gs). Guarda.
4. Ve a **Configuración del proyecto** (ícono de engranaje) → **Propiedades de la secuencia de comandos** → **Añadir propiedad**:
   - Propiedad: `SECRET`
   - Valor: una clave larga y aleatoria. Puedes generar una con `openssl rand -hex 24`.
   - Si creaste el script desde script.google.com en lugar de desde la hoja, añade también `SHEET_ID` con el ID de la hoja: lo que va entre `/d/` y `/edit` en su URL. Sin esto aparece el error `Cannot read properties of null (reading 'getSheetByName')`.
5. Pulsa **Implementar → Nueva implementación**:
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
6. Autoriza los permisos que pide Google y copia la **URL de la aplicación web** (termina en `/exec`).

"Cualquier usuario" es necesario para que Vercel pueda llamar al script. Sin la clave `SECRET` el script no lee ni escribe nada.

### 2. Publicar en Vercel

1. En Vercel, **Add New → Project** e importa este repositorio. No hace falta cambiar nada en la configuración de build.
2. En **Settings → Environment Variables**, añade:

| Variable | Valor |
| --- | --- |
| `APPS_SCRIPT_URL` | La URL `/exec` del paso 1.6 |
| `APPS_SCRIPT_SECRET` | La misma clave que pusiste como `SECRET` en el paso 1.4 |
| `CLAVE_RESULTADOS` | Una clave para ver y borrar resultados en la página. Compártela solo con tu equipo |

3. Vuelve a desplegar (**Deployments → Redeploy**) para que tome las variables.

### 3. Probar

1. Abre la página, responde 3 preguntas y pulsa **Guardar respuesta**.
2. Revisa que aparezca una fila en la pestaña **Respuestas** de la hoja.
3. Entra en **Resultados** con `CLAVE_RESULTADOS` y borra la respuesta de prueba.

## Cambiar las preguntas

Las preguntas están en el arreglo `Q` de `public/index.html`. Si agregas o renombras alguna, actualiza también:

- `COLUMNS` en `apps-script/Code.gs` (y vuelve a implementar el script: **Implementar → Gestionar implementaciones → Editar → Nueva versión**).
- `FIELDS` en `api/respuestas.js`.

Si cambias las columnas con respuestas ya guardadas, crea una pestaña nueva o ajusta los encabezados a mano para que coincidan.

## Desarrollo local

```bash
npm i -g vercel
vercel dev
```

Crea un archivo `.env.local` con las tres variables de la tabla anterior. No lo subas al repositorio (ya está en `.gitignore`).

## Estructura

```
public/index.html        Formulario y resultados (HTML, CSS y JS sin dependencias)
api/respuestas.js        Función de Vercel: GET resultados, POST guardar, DELETE borrar
apps-script/Code.gs      Script que lee y escribe la hoja de cálculo
```
