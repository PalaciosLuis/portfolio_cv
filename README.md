# Portfolio — Luis Palacios

Sitio web personal de **Luis Javier Palacios Sernaque**, Backend & Full-Stack Developer.

🔗 **Demo:** https://portfoliocv-steel.vercel.app/

## Qué es

Una página única que presenta mi perfil profesional, experiencia, skills y proyectos, con mi CV descargable.

- **Bilingüe (ES / EN)** con toggle y detección del idioma del navegador.
- **Sin dependencias ni build step:** HTML, CSS y JavaScript puro. Se sirve como estático.
- **Responsive** desde 320px.
- **Accesible:** HTML semántico, `aria-label` en controles, y respeto por `prefers-reduced-motion`.
- Lighthouse: sin JavaScript de terceros, sin frameworks, sin imágenes pesadas.

## Estructura

```
.
├── index.html                 # Página única (contenido ES + EN)
├── styles.css                 # Design system en variables CSS + responsive
├── main.js                    # Idioma, header sticky y animaciones al scroll
├── cv/
│   ├── Luis-Palacios-CV-ES.pdf
│   └── Luis-Palacios-CV-EN.pdf
└── .gitignore
```

## Cómo se cambia el contenido

- **Idioma:** cada texto está duplicado con `data-lang="es"` / `data-lang="en"`.
  El CSS oculta el que no corresponde y `main.js` cambia el atributo `lang` del `<html>`.
- **Colores y espaciados:** todo vive en las variables CSS de `:root` en `styles.css`.
- **Secciones:** `hero`, `sobre-mi`, `experiencia`, `skills`, `proyectos`, `contacto`.

## Correr localmente

```bash
python3 -m http.server 8080
# abrir http://127.0.0.1:8080
```

Cualquier servidor estático sirve. No hay `npm install`.

## Deploy

Pensado para **Vercel** como sitio estático: sin framework, sin build command, sin output directory.
Ver `odd/tasks/portfolio-web.md` para el checklist completo.

## Contacto

- Email: palaciossernaqueluisjavier@gmail.com
- LinkedIn: [luis-palacios-sernaque](https://www.linkedin.com/in/luis-palacios-sernaque)
- GitHub: [@PalaciosLuis](https://github.com/PalaciosLuis)
