importClass("XMLHttpRequest");
importClass( "VFile" );

function readFile(path) {
	var fi = new VFile( path ),
      fileInfo;

	if ( fi.open( VFile.OpenModeReadOnly ) ) {
		 fileInfo = {name: fi.info().fileName(), array: fi.readAll()};
		 fi.close();
	} else {
		var emptyArray = new VByteArray();
		fileInfo = {name: "empty", array: emptyArray};
	}
  return(fileInfo);
}

String.prototype.toVByteArray = function() {
	var bytex = new VByteArray();
	bytex.setText(this.toString());
	return(bytex);
};

Number.prototype.toVByteArray = function() {
	var bytex  = new VByteArray();
	bytex.setText(this.valueOf().toString());
	return(bytex);
};

function byteLength(str) {
  // returns the byte length of an utf8 string
  var s = str.length;
  for (var i=str.length-1; i>=0; i--) {
    var code = str.charCodeAt(i);
    if (code > 0x7f && code <= 0x7ff) s++;
    else if (code > 0x7ff && code <= 0xffff) s+=2;
    if (code >= 0xDC00 && code <= 0xDFFF) i--; //trail surrogate
  }
  return s;
}

function whatIsIt(object) {
	var stringConstructor = "test".constructor;
	var arrayConstructor = [].constructor;
	var objectConstructor = {}.constructor;

	if (object === null) { return "null"; }
    else if (object === undefined) { return "undefined"; }
    else if (object.constructor === stringConstructor) { return "String"; }
    else if (object.constructor === arrayConstructor) { return "Array"; }
	else if (object.constructor === objectConstructor) { return "Object"; }
    else { return "don't know"; }
}

function buildMultipartByteArray(fields) {
	var baseArray     = new VByteArray(),
		boundaryBase  = Date.now().toString(),
		boundaryStart = ("--" + boundaryBase).toVByteArray(),
		boundaryEnd   = ("--" + boundaryBase + "--").toVByteArray(),
		keys          = Object.keys(fields),
		i             = keys.length;

		var crlf_hex = new VByteArray();
		crlf_hex.setText("0D0A");

		var crlf = new VByteArray();
		crlf.fromHex(crlf_hex);

	for (z=0; z < i; z++) {
		var item   = keys[z],
			value  = fields[item],
		    header = ("Content-Disposition: form-data; name=\"" + item + "\"").toVByteArray();

		if ( whatIsIt(value) === "Object" && value.path !== undefined ) {
			var path 	   = value.path,
			    file       = readFile(path),
			    headerFile = ("Content-Disposition: form-data; name=\"" + item + "\"; filename=\"" + file.name + "\"").toVByteArray(),
			    headerType = "Content-Type: application/octet-stream".toVByteArray();

    			baseArray.append(boundaryStart);
    			baseArray.append(crlf);
    			baseArray.append(headerFile);
    			baseArray.append(crlf);
    			baseArray.append(headerType);
    			baseArray.append(crlf);
    			baseArray.append(crlf);
    			baseArray.append(file.array);
    			baseArray.append(crlf);

    } else if ( whatIsIt(value) === "Object" ) {

          header = "Content-Type: application/json".toVByteArray();
          baseArray.append(boundaryStart);
          baseArray.append(crlf);
          baseArray.append(header);
          baseArray.append(crlf);
          baseArray.append(crlf);
          baseArray.append((JSON.stringify(value)).toVByteArray());
          baseArray.append(crlf);

		} else if ( whatIsIt(value) === "Array" ) {
			var x = value.length;
			for ( y=0; y < x ; y++ ) {
					header = ("Content-Disposition: form-data; name=\"" + item + "[]\"").toVByteArray();

					baseArray.append(boundaryStart);
					baseArray.append(crlf);
					baseArray.append(header);
					baseArray.append(crlf);
					baseArray.append(crlf);
					baseArray.append((value[y]).toVByteArray());
					baseArray.append(crlf);
			}

		} else {
			baseArray.append(boundaryStart);
			baseArray.append(crlf);
			baseArray.append(header);
			baseArray.append(crlf);
			baseArray.append(crlf);
			baseArray.append((value).toVByteArray());
			baseArray.append(crlf);
		}
	}
	baseArray.append(boundaryEnd);
	return([baseArray, boundaryBase]);
}

function isMultipart(data) {
      var keys = Object.keys(data),
		  i    = keys.length;
	  while(i--) {
		   if ( whatIsIt( data[keys[i]] ) == "Object" && data[keys[i]].type == "file" ) {
			   return true;
		   }
	  }
	  return(false);
}

function getHeaders(headersString) {
	var headers = headersString.split("\n"),
		z       = headers.length,
		jsonHeaders = {},
		header, currentKey;
		
	for (i=0; i < z; i++) {
		header 	  = headers[i];
		extracted = header.match(/(.+): (.+)/);
		
		if ( extracted ) {
			currentKey = extracted[1];
			jsonHeaders[currentKey] = extracted[2];
		} else {
			if ( typeof(jsonHeaders[currentKey]) === "string" ) {
				jsonHeaders[currentKey] = [jsonHeaders[currentKey]];
			}
			jsonHeaders[currentKey].push(header);
		}
	}
	return jsonHeaders;
}

$ = {ajax: function(options) {
		var data    = options.data || {},
				headers = options.headers || {},
				url     = "",
		    body    = null,
		    xhr     = new XMLHttpRequest(),
				i;

		function jsonToParams(json) {
			var params = [], i;
			for ( i in json ) {
				if ( whatIsIt(json[i]) == "Array" ) {
					var values = json[i],
						z      = values.length;
					for( x=0; x < z; x++ ) { params.push("" + i + "[]" + "=" + values[x]); }
				} else {
					params.push(encodeURIComponent(i)+ "=" + encodeURIComponent(json[i]));
				}
			}
			return params.join("&");
		}

		if ( options.type.match(/(POST|PUT)/i) ) {
			url  = encodeURI(options.url);
			if ( options.data ) {
				if ( isMultipart(options.data) ) {
					var multi = buildMultipartByteArray(options.data);
						body   = multi[0];
						headers["Content-Type"] = "multipart/form-data; boundary=" + multi[1];
				} else {
					 if ( headers["Content-Type"] == "application/json" ) {
						body = JSON.stringify(options.data);
					 } else {
						body = jsonToParams(options.data);
						headers["Content-Type"] = 'application/x-www-form-urlencoded';
					 }
				}
			}
			if ( options.body ) {
				body = options.body;
				headers["Content-Length"] = byteLength(options.body);

				if ( headers["Content-Type"] === undefined ) {
						headers["Content-Type"]  = "application/octet-stream";
				}
			}

		} else {
			url  = options.url + "?" + jsonToParams(options.data);
		}

		if ( options.responseType ) { xhr.responseType = options.responseType; }

		xhr.timeout = options.timeout * 1000 || 15000;
		xhr.onreadystatechange = function() {
			switch(xhr.readyState) {
				case 4:

						if ( parseInt(xhr.status) > 199 && parseInt(xhr.status) < 300 ){
							if ( options.success && typeof(options.success) == "function" ) {
								var stringHeaders = xhr.getAllResponseHeaders(),
								jsonHeaders = getHeaders(stringHeaders);
								options.success(xhr.response, xhr.status, jsonHeaders, url);
							}
						} else if( parseInt(xhr.status) == 302 ) {
							var stringHeaders = xhr.getAllResponseHeaders(),
							jsonHeaders = getHeaders(stringHeaders);
							if ( options.redirect_to && typeof(options.redirect_to) === "function" ) {
								options.redirect_to(jsonHeaders.Location, jsonHeaders);
							}
						} else {
							if ( options.error && typeof(options.error) == "function" ) {
								options.error(xhr.response, xhr.status,url);
							}
						}
						break;
			}
		};

		xhr.open(options.type.toUpperCase(), url, options.async || true);
		for (i in headers) { xhr.setRequestHeader(i, headers[i]); }
		if ( body ) { xhr.send(body); } else { xhr.send(); }
		while(xhr.readyState != 4) { xhr.processEvents(); }
	}
};
