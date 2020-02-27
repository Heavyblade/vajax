importClass("XMLHttpRequest");
importClass( "VFile" );
importClass("VTextFile");

function readFile(path) {
	var isText = path.match(/\.(xml|json|csv|txt|html|html)$/) !== null ,
		fi     =  isText ? (new VTextFile(path)) : (new VFile(path)),
		fileInfo;

	if ( fi.open( VFile.OpenModeReadOnly ) ) {
		 if ( isText ) {
			fi.setCodec("UTF-8");
			fileInfo = {name: fi.fileName().split("/").pop(), array: (fi.readAll()).toVByteArray() };
		 } else {
			fileInfo = {name: fi.info().fileName(), array: fi.readAll()};
		 }

		 fi.close();
	} else {
		var emptyArray = new VByteArray();
		fileInfo = {name: "empty", array: emptyArray};
	}

  return(fileInfo);
}

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
			contentType = ("Content-Type: text/plain; charset=UTF-8").toVByteArray(),
		    header = ("Content-Disposition: form-data; name=\"" + item + "\"").toVByteArray();

		if ( whatIsIt(value) === "Object" && value.path !== undefined ) {
			var path 	   = value.path,
			    file       = readFile(path),
			    headerFile = ("Content-Disposition: form-data; name=\"" + item + "\"; filename=\"" + file.name + "\"").toVByteArray(),
			    headerType = ("Content-Type: " + ($.extensions[path.split(".").pop()] || "application/octet-stream") ).toVByteArray();

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
			baseArray.append(contentType);
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
			return params.length > 0 ? params.join("&") : "";
		}

		if ( options.type.match(/(POST|PUT|PATCH)/i) ) {
			url = encodeURI(options.url);
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
				headers["Content-Length"] = typeof(options.body) == "string" ? byteLength(options.body) : options.body.length; 

				if ( headers["Content-Type"] === undefined ) {
						headers["Content-Type"]  = "application/octet-stream";
				}
			}

			if ( options.urlParams ) {
				url  = options.url + "?" + jsonToParams(options.urlParams);
			}

		} else {
			url  = encodeURI(options.url) + "?" + jsonToParams(options.data);
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
    for (i in headers) {
      var h_value = headers[i];
      if (whatIsIt(h_value) === "Array") {
        _.each(h_value, function(val) { xhr.setRequestHeader(i, val); });
      } else {
        xhr.setRequestHeader(i, h_value);
      }
    }

		if ( body ) { xhr.send(body); } else { xhr.send(); }
		while(xhr.readyState != 4) { xhr.processEvents(); }
	},
	extensions: {
		"htm": "text/html",
		"html": "text/html",
		"shtml": "text/html",
		"css": "text/css",
		"xml": "text/xml; charset=utf-8",
		"gif": "image/gif",
		"jpeg": "image/jpeg",
		"jpg": "image/jpeg",
		"js": "application/x-javascript",
		"atom": "application/atom+xml",
		"rss": "application/rss+xml",
		"mml": "text/mathml",
		"txt": "text/plain",
		"jad": "text/vnd.sun.j2me.app-descriptor",
		"wml": "text/vnd.wap.wml",
		"htc": "text/x-component",
		"png": "image/png",
		"tif": "image/tiff",
		"tiff": "image/tiff",
		"wbmp": "image/vnd.wap.wbmp",
		"ico": "image/x-icon",
		"jng": "image/x-jng",
		"bmp": "image/x-ms-bmp",
		"svg": "image/svg+xml",
		"webp": "image/webp",
		"jar": "application/java-archive",
		"war": "application/java-archive",
		"ear": "application/java-archive",
		"hqx": "application/mac-binhex40",
		"doc": "application/msword",
		"pdf": "application/pdf",
		"ps": "application/postscript",
		"eps": "application/postscript",
		"ai": "application/postscript",
		"rtf": "application/rtf",
		"xls": "application/vnd.ms-excel",
		"ppt": "application/vnd.ms-powerpoint",
		"wmlc": "application/vnd.wap.wmlc",
		"kml": "application/vnd.google-earth.kml+xml",
		"kmz": "application/vnd.google-earth.kmz",
		"7z": "application/x-7z-compressed",
		"cco": "application/x-cocoa",
		"jardiff": "application/x-java-archive-diff",
		"jnlp": "application/x-java-jnlp-file",
		"run": "application/x-makeself",
		"pl": "application/x-perl",
		"pm": "application/x-perl",
		"prc": "application/x-pilot",
		"pdb": "application/x-pilot",
		"rar": "application/x-rar-compressed",
		"rpm": "application/x-redhat-package-manager",
		"sea": "application/x-sea",
		"swf": "application/x-shockwave-flash",
		"sit": "application/x-stuffit",
		"tcl": "application/x-tcl",
		"tk": "application/x-tcl",
		"der": "application/x-x509-ca-cert",
		"pem": "application/x-x509-ca-cert",
		"ctr": "application/x-x509-ca-cert",
		"xpi": "application/x-xpinstall",
		"xhtml": "application/xhtml+xml",
		"zip": "application/zip",
		"bin": "application/octet-stream",
		"exe": "application/octet-stream",
		"dll": "application/octet-stream",
		"deb": "application/octet-stream",
		"dmg": "application/octet-stream",
		"eot": "application/octet-stream",
		"iso": "application/octet-stream",
		"img": "application/octet-stream",
		"mis": "application/octet-stream",
		"map": "application/octet-stream",
		"msm": "application/octet-stream",
		"mid": "audio/midi",
		"midi": "audio/midi",
		"kar": "audio/midi",
		"mp3": "audio/mpeg",
		"ogg": "audio/ogg",
		"ra": "audio/x-realaudio",
		"3gpp": "video/3gpp",
		"3gp": "video/3gpp",
		"mpeg": "video/mpeg",
		"mpg": "video/mpeg",
		"mov": "video/quicktime",
		"flv": "video/x-flv",
		"mng": "video/x-mng",
		"asx": "video/x-ms-asf",
		"asf": "video/x-ms-asf",
		"wmv": "video/x-ms-wmv",
		"avi": "video/x-msvideo",
		"m4v": "video/mp4",
		"mp4": "video/mp4"
	}
};

_ = {
	sortArray: function(array) {
		return(Object.keys(array).sort(function (a, b) {
		  if (a < b) return -1;
		  else if (a > b) return 1;
		  return 0;
	    }));
	},
	intersect: function(a,b) {
		var t;
		if (b.length > a.length) t = b, b = a, a = t;
		return a.filter(function (e) {
			if (b.indexOf(e) !== -1) return true;
		});	
	},
	find: function(array, filter) {
			var z 	   = array.length,
				item;

			for( var i=0; i < z; i++ ) {
				item = array[i];
				if ( filter(array[i]) ) { return(item); }
			}
			return(null);
	},
	each: function(array, callback) {
			var x = [],
				z = array.length,
				record;

			for( var i=0; i < z; i++ ) { callback(array[i],i); }
	},
	map: function(array, callback) {
			var x = [],
				z = array.length,
				record;

			for( var i=0; i < z; i++ ) {x.push(callback(array[i])); }
			return x;
	},
    select: function(array, callback) {
			var x = [],
				z = array.length,
				record;

			for( var i=0; i < z; i++ ) {
				record = array[i];
				if ( callback(record, i) ) { x.push(record); } 
			}
			return(x);
	},
	findVRegisterList: function(vregisterlist, filter) {
			var z 	   = vregisterlist.listSize(),
				record = undefined;

			for(var i=0; i < z; i++) {
				record = vregisterlist.readAt(i);
				if ( filter(record) ) { break; } 
			}
			return(record);
	},
	mapVRegisterList: function(vregisterlist, callback) {
			var z 	   = vregisterlist.listSize(),
				result = [],
				record;

			for(var i=0; i < z; i++) {
				record = vregisterlist.readAt(i);
				result.push(callback(record, i));
			}
			return(result);
	},
	eachVRegisterList: function(vregisterlist, callback) {
			var z = vregisterlist.listSize(),
				record;
			for(var i=0; i < z; i++) { 
				record = vregisterlist.readAt(i);
				callback(record);
			}
	},
	reduceVRegisterList: function(vregisterlist, callback, memo) {
			var z 	   = vregisterlist.listSize(),
				result = [],
				record;

			for(var i=0; i < z; i++) {
				record = vregisterlist.readAt(i);
				memo   = callback(record, memo, i);
			}

			return(memo);
	},
	reduce: function(array, memo, callback) {
      var z = array.length;

        for( var i=0; i < z; i++ ) {
          memo = callback(array[i], memo);
        }
      return memo;
    }
};
