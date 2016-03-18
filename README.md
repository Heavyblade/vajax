# vAjax
Implementación $.ajax para la plataforma Velneo v7

El objetivo de $.ajax es emular la simplicidad de la implementación de peticiones ajax de JQuery

### uso rápido

```javascript
#include "(CurrentProject)/ajax.js"
$.ajax({
  type: "GET",
  url: "http://github.com/heavyblade.json",
  data: {username: "heavyblade"},
  responseType: "json",
  success: function(data, http_status) {
          // Some of your code here !
  },
  error: function(data, http_status) {
          // Some of your code here !
  }
})
```
## opciones

opcion | descripcion
--- | ---
type | Tipo de request http GET, POST, PUT o DELETE.
url | url completa del web server hacia el cual se hará la petición.
responseType | Opción de velneo v7 "json" o "arraybuffer", sirve para que automáticamente velneo haga un decode hacia un JSON o un vByteArray de la respuesta del servidor.
timeout | Indica en segundos cuanto tomará la petición antes de levantar un error por timeout, por defecto 15 segs.
headers | Es un objeto json donde podras indicar headers personalizados que quieres que se incluyan en el request.
data |Es un objeto con los parametros que deseas que lleve el request, si la petición es POST la libreria automáticamente realizará el formateo del objeto a un form-data y si se indica en los headers un "Content-Type": "application/json" se hará la conversión a un JSON string para el cuerpo del request.
success | función que se llamará cuando el request haya terminado y se le entregaran la data obtenida y el código http de la respuesta.
error | Función que se llamara si hay algun error con el request o si el servidor devuelve un código error como un 400 o un 500, entrega la data enviada por el servidor si la hay y el codigo de respuesta.

## Ejemplos:

Simple petición GET:
```javascript
#include "(CurrentProject)/ajax.js"
$.ajax({
  type: "GET",
  url: "http://github.com/heavyblade.json",
  data: {username: "heavyblade"},
  responseType: "json",
  success: function(data, http_status) {
          // Some of your code here !
  },
  error: function(data, http_status) {
          // Some of your code here !
  }
})
```

Petición POST simple:

```javascript
#include "(CurrentProject)/ajax.js"
$.ajax({
  type: "POST",
  url: "http://github.com/heavyblade.json",
  data: {username: "heavyblade", desc: "mas datos", edad: 78},
  responseType: "json",
  success: function(data, http_status) {
          // Some of your code here !
  },
  error: function(data, http_status) {
          // Some of your code here !
  }
})
```

Petición post con JSON en el body:

```javascript
#include "(CurrentProject)/ajax.js"
$.ajax({
  type: "POST",
  url: "http://github.com/heavyblade.json",
  data: {username: "heavyblade", desc: "mas datos", edad: 78},
  headers: {"Content-Type": "application/json"},
  responseType: "json",
  success: function(data, http_status) {
          // Some of your code here !
  },
  error: function(data, http_status) {
          // Some of your code here !
  }
})
```

Petición para descargar un archivo:

```javascript
#include "(CurrentProject)/ajax.js"
$.ajax({
	type: "POST",
	responseType: "arraybuffer",
	url : "https://content.dropboxapi.com/2/files/download",
	headers : {Authorization:  "xxxxxxxxxx" },
	timeout: (30 * 60),
	success: function(data, status, composeURL) {
				var fi = new VFile( "D://nuevo_archivo.txt" );

				if ( fi.open( VFile.OpenModeWriteOnly | VFile.OpenModeTruncate) ) {
					fi.write(data);
					fi.close();
				}
	}
});
```

Petición para descargar una imagen y almacenarla en tabla:

```javascript
#include "(CurrentProject)/ajax.js"
importClass( "VImage" );

$.ajax({
	type: "GET",
	responseType: "arraybuffer",
	url : "http://i.emezeta.com/cache/img/1398_o.jpg",
	success: function(data, status, composeURL) {
			  		if ( theRoot.beginTrans( "Añadir imagen" ) ) {

									var respuestaBA  = new VByteArray();
										respuestaBA    = data;
										respuesta      = respuestaBA

									var image = new VImage();
                  image.loadFromData(respuestaBA, "JPG");

                  var grafico = new VRegister(theRoot);
									grafico.setTable("dat/GRAFICAS");

                  grafico.setFieldImage("FOTO", image);
								  grafico.setField("NAME", "Hola mundo");

									// Se guarda el registro				
									grafico.addRegister()
									theRoot.commitTrans();
					}
	}
});
```

Petición multipart para subida de archivos

```javascript
#include "(CurrentProject)/ajax.js"
$.ajax({
  type: "POST",
  url: "http://some_cloud.com/api/upload",
  data: {username: "heavyblade",
         image1:   {type: "file", path: "D://carpeta/imagen.png"},
         archivo:  {type: "file", path: "D://carpeta/archivo.txt"}
  },
  responseType: "json",
  success: function(data, http_status) {
          // Some of your code here !
  },
  error: function(data, http_status) {
          // Some of your code here !
  }
})
```
