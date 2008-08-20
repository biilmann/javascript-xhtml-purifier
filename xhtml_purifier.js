/*
 * HTML Parser By John Resig (ejohn.org)
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 *
 * // Use like so:
 * HTMLParser(htmlString, {
 *     start: function(tag, attrs, unary) {},
 *     end: function(tag) {},
 *     chars: function(text) {},
 *     comment: function(text) {}
 * });
 *
 * // or to get an XML string:
 * HTMLtoXML(htmlString);
 *
 * // or to get an XML DOM Document
 * HTMLtoDOM(htmlString);
 *
 * // or to inject into an existing document/DOM node
 * HTMLtoDOM(htmlString, document);
 * HTMLtoDOM(htmlString, document.body);
 *
 */

(function(){

	// Regular Expressions for parsing tags and attributes
	var startTag = /^<(\w+)((?:\s+\w+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
		endTag = /^<\/(\w+)[^>]*>/,
		attr = /(\w+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g;
		
	// Empty Elements - HTML 4.01
	var empty = makeMap("area,base,basefont,br,col,frame,hr,img,input,isindex,link,meta,param,embed");

	// Block Elements - HTML 4.01
	var block = makeMap("address,applet,blockquote,button,center,dd,del,dir,div,dl,dt,fieldset,form,frameset,hr,iframe,ins,isindex,li,map,menu,noframes,noscript,object,ol,p,pre,script,table,tbody,td,tfoot,th,thead,tr,ul");

	// Inline Elements - HTML 4.01
	var inline = makeMap("a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var");

	// Elements that you can, intentionally, leave open
	// (and which close themselves)
	var closeSelf = makeMap("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr");

	// Attributes that have their values filled in disabled="disabled"
	var fillAttrs = makeMap("checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected");

	// Special Elements (can contain anything)
	var special = makeMap("script,style");

	var HTMLParser = this.HTMLParser = function( html, handler ) {
		var index, chars, match, stack = [], last = html;
		stack.last = function(){
			return this[ this.length - 1 ];
		};

		while ( html ) {
			chars = true;

			// Make sure we're not in a script or style element
			if ( !stack.last() || !special[ stack.last() ] ) {

				// Comment
				if ( html.indexOf("<!--") == 0 ) {
					index = html.indexOf("-->");
	
					if ( index >= 0 ) {
						if ( handler.comment )
							handler.comment( html.substring( 4, index ) );
						html = html.substring( index + 3 );
						chars = false;
					}
	
				// end tag
				} else if ( html.indexOf("</") == 0 ) {
					match = html.match( endTag );
	
					if ( match ) {
						html = html.substring( match[0].length );
						match[0].replace( endTag, parseEndTag );
						chars = false;
					}
	
				// start tag
				} else if ( html.indexOf("<") == 0 ) {
					match = html.match( startTag );
	
					if ( match ) {
						html = html.substring( match[0].length );
						match[0].replace( startTag, parseStartTag );
						chars = false;
					}
				}

				if ( chars ) {
					index = html.indexOf("<");
					
					var text = index < 0 ? html : html.substring( 0, index );
					html = index < 0 ? "" : html.substring( index );
					
					if ( handler.chars )
						handler.chars( text );
				}

			} else {
				html = html.replace(new RegExp("(.*)<\/" + stack.last() + "[^>]*>"), function(all, text){
					text = text.replace(/<!--(.*?)-->/g, "$1")
						.replace(/<!\[CDATA\[(.*?)]]>/g, "$1");

					if ( handler.chars )
						handler.chars( text );

					return "";
				});

				parseEndTag( "", stack.last() );
			}

			if ( html == last )
				throw "Parse Error: " + html;
			last = html;
		}
		
		// Clean up any remaining tags
		parseEndTag();

		function parseStartTag( tag, tagName, rest, unary ) {
			if ( block[ tagName ] ) {
				while ( stack.last() && inline[ stack.last() ] ) {
					parseEndTag( "", stack.last() );
				}
			}

			if ( closeSelf[ tagName ] && stack.last() == tagName ) {
				parseEndTag( "", tagName );
			}

			unary = empty[ tagName ] || !!unary;

			if ( !unary )
				stack.push( tagName );
			
			if ( handler.start ) {
				var attrs = [];
	
				rest.replace(attr, function(match, name) {
					var value = arguments[2] ? arguments[2] :
						arguments[3] ? arguments[3] :
						arguments[4] ? arguments[4] :
						fillAttrs[name] ? name : "";
					
					attrs.push({
						name: name,
						value: value,
						escaped: value.replace(/(^|[^\\])"/g, '$1\\\"') //"
					});
				});
	
				if ( handler.start )
					handler.start( tagName, attrs, unary );
			}
		}

		function parseEndTag( tag, tagName ) {
			// If no tag name is provided, clean shop
			if ( !tagName )
				var pos = 0;
				
			// Find the closest opened tag of the same type
			else
				for ( var pos = stack.length - 1; pos >= 0; pos-- )
					if ( stack[ pos ] == tagName )
						break;
			
			if ( pos >= 0 ) {
				// Close all the open elements, up the stack
				for ( var i = stack.length - 1; i >= pos; i-- )
					if ( handler.end )
						handler.end( stack[ i ] );
				
				// Remove the open elements from the stack
				stack.length = pos;
			}
		}
	};
	
	function makeMap(str){
		var obj = {}, items = str.split(",");
		for ( var i = 0; i < items.length; i++ )
			obj[ items[i] ] = true;
		return obj;
	}
})();

XHTMLPurifier = function() {
  var result;
  var stack = [];
  var reopen_after = {};

  // For nesting rules used here - see: http://www.cs.tut.fi/~jkorpela/html/nesting.html
  var allowed_elements = {
    'p': {'contains': 'inline', 'flow': 'block'},
    'a': {'contains': 'inline', 'excluding': {'a':true}, 'attributes': {'href':true,'name':true,'title':true, 'rel':true, 'rev':true}, 'flow': 'inline'},
    'strong': {'contains': 'inline', 'flow': 'inline'},
    'b': {'change_to': 'strong'},
    'h1': {'change_to': ['p','strong']},
    'h2': {'change_to': ['p','strong']},
    'h3': {'change_to': ['p','strong']},
    'h4': {'change_to': ['p','strong']},
    'h5': {'change_to': ['p','strong']},
    'h6': {'change_to': ['p','strong']},
    'h7': {'change_to': ['p','strong']},
    'em': {'contains': 'inline', 'flow': 'inline'},
    'ul': {'contains': 'li', 'flow': 'block'},
    'ol': {'contains': 'li', 'flow': 'block'},
    'li': {'contains': 'flow', 'flow': 'block'},
    'br': {'contains': false, 'flow': 'inline'},
    'img': {'contains': false, 'attributes': {'src':true,'alt':true}, 'flow': 'inline'},
    'blockquote': {'contains': 'flow', 'attributes': {'cite':true}, 'flow': 'block'},
    'code': {'contains': 'inline', 'flow': 'inline'},
    'pre': {'contains': 'inline', 'excluding': {'img': true}, 'flow': 'block'}
  };
  
  function in_stack(tagName) {
    for(var i=stack.length; i>0; i--) {
      if(tagName == stack[i].name) {
        return true;
      }
    }
    return false;
  }

  function stack_last() {
    var len = stack.length;
    return len > 0 ? stack[stack.length - 1] : null;
  }

  function can_contain(parentName, childName) {
    var parent = allowed_elements[parentName];
    if(parent['excluding'] && parent['excluding'][childName]) {
      return false;
    }
    if(parent.contains == 'flow' || parent.contains == childName) {
        return true;
    }
    var child = allowed_elements[childName];
    return parent.contains == child.flow;
  }

  function chars(text) {
    result += text;
  }

  function start(tagName, attrs, unary) {
    tagName = tagName.toLowerCase();
    var tag = allowed_elements[tagName];
    var parent = stack_last();
    if(tag) {
      var change_to = tag['change_to'];
      if(change_to) {
        if(typeof(change_to) == 'string') {
          tagName = change_to;
        } else {
          for(var i in change_to) {
            start(change_to[i], [], false);
          }
          return;
        }
      }
      result += ("<" + tagName);
      for(var i in attrs) {
        var attr  = attrs[i].name.toLowerCase();
        var value = attrs[i].value;
        if(tag['attributes'] && tag['attributes'][attr]) {
          result += (" " + attr + '="' + value + '"');
        }
      }
      if(unary) {
        result += ' />';
      } else {
        result += '>';
        stack.push({name: tagName, attrs: attrs, unary: unary});
      }
    }
  }

  function end(tagName) {
    if(typeof(tagName) == 'undefined' || tagName == null) {
      return;
    }
    tagName = tagName.toLowerCase();
    if(!allowed_elements[tagName]) {
      return;
    }
    var change_to = allowed_elements[tagName]['change_to'];
    if(change_to) {
      if(typeof(change_to) == 'string'){
        tagName = change_to;
      } else {
        for(var i=change_to.length; i>0; i--) {
          end(change_to[i-1]);
        }
        return;
      }
    }    
    curTag = stack.pop();
    if(curTag.name != tagName && stack.length != 0) {
      stack.push(curTag);
      end(curTag.name);
    }
    result += '</' + tagName + '>';
  }

  return {
    purify: function(text) {
      result = "";
      try {
        HTMLParser(text, {
          start: start,
          end: end,
          chars: chars
        });
      } catch(e) {
        throw e;
        return result;
      }
      // Remove empty tags and return
      return result.replace(/<(\w+)[^>]*>\s*<\/\1\s*>/g, '');
    }
  };
}();