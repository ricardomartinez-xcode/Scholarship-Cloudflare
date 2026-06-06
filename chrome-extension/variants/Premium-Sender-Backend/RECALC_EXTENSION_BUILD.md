# ReCalc Sender Popup

Tipo: Chrome extension con `default_popup`.

Base usada: `Premium-Sender-Chrome-Web-Store.zip`.

Backend conectado:

```txt
https://recalc.relead.com.mx
```

Rutas legacy usadas por esta variante:

```txt
/mv3/get-license.php
/mv3/logout.php
/mv3/templates.php
/mv3/getresponse.php
/mv3/general-data-1.php
/mv3/dom-selectors.php
/uninstall.php
```

Estrategia de licencia:

```txt
La extensión conserva nombres internos legacy como license/license_key porque el código minificado depende de esos campos.
El backend ReCalc debe responder full access con license_required=false.
```

Esta variante conserva la lógica de scripts y funciones del Premium Sender original, pero con dominio, permisos, iconos y branding de ReCalc.
