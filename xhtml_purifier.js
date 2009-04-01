/*
 * XHTML Purifier By Mathias Biilmann Christensen
 * and Rodrigo Alvarez
 * Copyright Domestika 2008
 *
 */

XHTMLPurifier = function() {
  var allowHeaders = true;

  var stack = [];
  var active_elements = [];
  var doc;
  var root;
  var insertion_mode;

  var textContent = function(node) {
    return node.textContent;
  };

  var scope_markers = {'td':true, 'th': true, 'caption':true};
  var formatting_elements = {'a':true, 'em':true, 'strong':true};
  var tags_with_implied_end = {'li':true, 'p':true};
  var allowed_attributes = {
      'a': {'href':true, 'title':true, 'name':true, 'rel':true, 'rev':true, 'type':true},
    'blockquote': {'cite':true},
    'img': {'src':true, 'alt':true, 'title':true, 'longdesc':true},
    'td': {'colspan':true, 'class':true},
    'th': {'colspan':true, 'class':true},
    'tr': {'rowspan':true, 'class':true},
    'table': {'class':true}
  };

  var XHTMLPrettyPrinter = function() {
    var empty_tags = {'BR': true, 'HR': true, 'INPUT': true, 'IMG': true};
    var dont_indent_inside = {'STRONG':true, 'EM':true, 'A':true};
    var indent = false;
    var indent_string = "  ";

    function indentation(depth, switchOff) {
      if(!indent) {
        return "";
      }
      if(switchOff) {
        indent = false;
      }
      var result = "\n";
      for(var i=0; i<depth; i++) {
        result += indent_string;
      }
      return result;
    }

    function attributes(el) {
      var result = "";
      var allowed = allowed_attributes[el.tagName.toLowerCase()] || {};
      for(var i=0, len=el.attributes.length; i<len; i++) {
        if(allowed[el.attributes[i].nodeName.toLowerCase()] && el.attributes[i].nodeValue) {
          result += " " + el.attributes[i].nodeName.toLowerCase() + '="' + el.attributes[i].nodeValue + '"';
        }
      }
      return result;
    }

    function startTag(el) {
      return "<" + el.tagName.toLowerCase() + attributes(el) + ">";
    }

    function endTag(el) {
      return "</" + el.tagName.toLowerCase() + ">";
    }

    function emptyTag(el) {
      return "<" + el.tagName.toLowerCase() + attributes(el) + " />";
    }

    function element(el, depth) {
      if(el.nodeType == 3 && !el.nodeValue.match(/^\s*$/)) {
        return indentation(depth || 0, true) + el.nodeValue;
      } else if(el.nodeType != 1) {
        return "";
      }
      var len = el.childNodes.length;
      if(len == 0) {
        if(empty_tags[el.tagName]) {
          return indentation(depth || 0, true) + emptyTag(el);
        }
        indent = dont_indent_inside[el.tagName] ? indent : true;
        return indentation(depth || 0) + startTag(el) + endTag(el);
      } else {
        indent = dont_indent_inside[el.tagName] ? indent : true;
        var result = (depth === false ? "" : indentation(depth, dont_indent_inside[el.tagName] ? true : false)) + startTag(el);
        for(var i=0; i<len; i++) {
          result += element(el.childNodes[i], (depth || 0) + 1);
        }
        indent = dont_indent_inside[el.tagName] ? indent : true;
        return result + indentation(depth || 0) + endTag(el);
      }
    }

    return {
      pretty_print: function(dom, indent_first_element) {
        return element(dom, indent_first_element ? 0 : false);
      }
    };
  }();

  function init() {
    doc = document;
    root = doc.createElement('html');
		var p = doc.createElement('p');
		// Internet explorer doesn't support textContent
		if(typeof(p.textContent) == 'undefined') {
		  textContent = function(node) {
		    return node.innerText;
		  };
		}
		root.appendChild(p);
    stack = [root, p];
    active_elements = [];
  }

  function last_el(list) {
    var len = list.length;
    if(len == 0) {
      return null;
    }
    return list[len - 1];
  }

  function in_array(arr, elem) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] === elem) return true;
    }
    return false;
  }

  function current_node() {
    return last_el(stack) || doc;
  }

  function reconstruct_the_active_formatting_elements() {
    if(active_elements.length == 0 || in_array(stack, last_el(active_elements))) {
      return;
    }
    var entry;
    for(var i = active_elements.length; i>0; i--) {
      entry = active_elements[i-1];
      if(in_array(stack, entry)) {
        break;
      }
    }
    do {
      var clone = entry.cloneNode(false);
      current_node().appendChild(clone);
      stack.push(clone);
      active_elements[i] = clone;
      i += 1;
    } while(i != active_elements.length)
  }

  function has_element_with(arr_of_elements, tagName) {
    for(var i = arr_of_elements.length; i>0; i--) {
      if(arr_of_elements[i-1].nodeName.toLowerCase() == tagName) {
        return true;
      }
    }
    return false;
  }

  function in_scope(tagName) {
    return has_element_with(stack, tagName);
  }
  
  function in_table_scope(tagName) {
    for(var i = stack.length; i>0; i--) {
      var nodeTag = stack[i-1].nodeName.toLowerCase();
      if(nodeTag == tagName) {
        return true;
      } else if(nodeTag == 'table' || nodeTag == 'html') {
        return false;
      }
    }
    return false;
  }

  function insert_html_element_for(tagName, attrs) {
    var node = doc.createElement(tagName);
    if(allowed_attributes[tagName]) {
      for(var i in attrs) {
        var attr = attrs[i];
        if(allowed_attributes[tagName][attr.name]){
          node.setAttribute(attr.name, attr.value);
        }
      }
    }
    current_node().appendChild(node);
    stack.push(node);
    return node;
  }

  function generate_implied_end_tags(exception) {
    var tagName = current_node().tagName.toLowerCase();
    while(tags_with_implied_end[tagName] && tagName != exception) {
      end(tagName);
      var tagName = current_node().tagName.toLowerCase();
    }
  }

  // This function does not form part of the HTML5 specification
  function remove_node_if_empty(node) {
    if(node.getElementsByTagName("*").length == 0 && textContent(node).match(/^\s*$/g)) {
      node.parentNode.removeChild(node);
    }
  }

  function trim_to_1_space(str) {
  	return str.replace(/^\s+/, ' ').replace(/\s+$/, ' ');
  }

  // This is a bit of a hack to convert entities without a complex regexp
  // will have to look into performace and possible memory leaks in IE
  function html_entity_decode(str) {
    var ta=document.createElement("textarea");
    ta.innerHTML = str;
    var result = ta.value;
    delete(ta);
    return result;
  }
  
  function clear_stack_to_table_context() {
    clear_stack_to_context_by_tags(['table', 'html']);
  }
  
  function clear_stack_to_table_body_context() {
    clear_stack_to_context_by_tags(['tbody', 'tfoot', 'thead', 'html']);
  }
  
  function clear_stack_to_table_row_context() {
    clear_stack_to_context_by_tags(['tr', 'html']);
  }
  
  function clear_stack_to_context_by_tags(tags) {
    while(!in_array(tags, current_node().tagName.toLowerCase())) {
      stack.pop();
    }
  }
  
  function clear_active_elements_to_last_marker() {
    do {
      var entry = active_elements.pop();
    } while(!scope_markers[entry.tagName.toLowerCase()]);
  }
  
  function reset_insertion_mode() {
    var last = false;
    for (var i = stack.length - 1; i >= 0; i--){
      var node = stack[i];
      if (node == stack[0]) {
        last = true;
      }
      switch(node.tagName.toLowerCase()) {
        case 'th':
        case 'td':
          if (!last) {
            insertion_mode = InCell;
            return;
          }
        case 'tr':
          insertion_mode = InRow;
          return;
        case 'tbody':
        case 'thead':
        case 'tfoot':
          insertion_mode = InTableBody;
          return;
        case 'caption':
          insertion_mode = InCaption;
          return;
        case 'colgroup':
          insertion_mode = InColumnGroup;
          return;
        case 'table':
          insertion_mode = InTable;
          return;
      }
      if (last) {
        insertion_mode = InBody;
        return;
      }
    };
  }
  
  function close_the_cell() {
    if (in_table_scope('td')) {
      end('td');
    } else {
      end('th');
    }
  }
  
  function start(tagName, attrs, unary) {
    insertion_mode.insertion_mode_start(tagName, attrs, unary);
  }
  
  function end(tagName) {
    insertion_mode.insertion_mode_end(tagName);
  }

  function chars(text) {
    if(typeof(text) == 'undefined') {
      return;
    }
    text = html_entity_decode(text).replace(/\n\s*\n\s*\n*/g,'\n\n').replace(/(^\n\n|\n\n$)/g,'');
    var paragraphs = text.split('\n\n');
    if(paragraphs.length > 1) {
      for(var i in paragraphs) {
        start('p');
        reconstruct_the_active_formatting_elements();
        var trimmedText = trim_to_1_space(paragraphs[i]);
        var textNode = doc.createTextNode(trimmedText);
        current_node().appendChild(textNode);
        end('p');
      }
    } else {
      if(text.match(/^\s*$/g) && current_node().lastChild && current_node().lastChild.tagName == 'BR') {
        return;
      }
      reconstruct_the_active_formatting_elements();
      var trimmedText = trim_to_1_space(paragraphs[0]);
      var textNode = doc.createTextNode(trimmedText);
      current_node().appendChild(textNode);
    }
  }
  
  var InBody = {
    insertion_mode_start: function (tagName, attrs, unary) {
      tagName = tagName.toLowerCase();
      switch(tagName) {
        case 'b':
          start('strong');
          return;
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
        case 'h7':
          if(allowHeaders == false) {
            start('p');
            start('strong');
            return;
          }
        case 'blockquote':
        case 'ol':
        case 'p':
        case 'ul':
        case 'pre': // Techically PRE shouldn't be in this groups, since newlines should be ignored after a pre tag
          if(in_scope('p')) {
            end('p');
          }
          insert_html_element_for(tagName, attrs);
          return;
        case 'li':
          if(in_scope('p')) {
            end('p');
          }
          var node = current_node();
          while(node.tagName == 'LI') {
            stack.pop();
          }
          insert_html_element_for(tagName, attrs);
          return;
        case 'a':
          for(var i=active_elements.length; i>0; i--) {
            if(active_elements[i-1].tagName == 'A') {
              end('a');
              active_elements.splice(i-1,1);
            }
          }
          reconstruct_the_active_formatting_elements();
          var node = insert_html_element_for(tagName, attrs);
          active_elements.push(node);
          return;
        case 'strong':
        case 'em':
          reconstruct_the_active_formatting_elements();
          var node = insert_html_element_for(tagName, attrs);
          active_elements.push(node);
          return;
        case 'table':
          if (in_scope('p')) {
            end('p');
          }
          insert_html_element_for(tagName, attrs);
          insertion_mode = InTable;
          return;
        case 'br':
        case 'img':
          reconstruct_the_active_formatting_elements();
          // These conditions for BR tags are not part of the HTML5 specification
          //   but serve to make sure we don't add BR tags to empty elements and
          //   to make sure we create paragraphs instead of double BRs
          if(tagName == 'br') {
            if(textContent(current_node()).match(/^\s*$/g)) {
              return;
            }
            if(current_node().lastChild && current_node().lastChild.tagName == 'BR') {
              current_node().removeChild(current_node().lastChild);
              start('p');
              return;
            }
          }
          insert_html_element_for(tagName, attrs);
          stack.pop();
          return;
      }
    },

    insertion_mode_end: function (tagName) {
      if(typeof(tagName) == undefined) {
        return;
      }
      tagName = tagName.toLowerCase();
      switch(tagName) {
        case 'b':
          end('strong');
          return;
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
        case 'h7':
          if(allowHeaders == false) {
            end('strong');
            end('p');
            return;
          }
          if(in_scope(tagName)) {
            generate_implied_end_tags();
            do {
              var node = stack.pop();
            } while(node.tagName.toLowerCase() != tagName);
          }
          return;
        case 'blockquote':
        case 'ol':
        case 'ul':
        case 'pre': // Techically PRE shouldn't be in this groups, since newlines should be ignored after a pre tag
          if(in_scope(tagName)) {
            generate_implied_end_tags();
          }
          if(in_scope(tagName)) {
            do {
              var node = stack.pop();
            } while(node.tagName.toLowerCase() != tagName);
            remove_node_if_empty(node);
          }
          return;
        case 'p':
          if(in_scope(tagName)) {
            generate_implied_end_tags(tagName);
          }
          var no_p_in_scope = true;
          var node;
          while(in_scope(tagName)) {
            no_p_in_scope = false;
            node = stack.pop();
          }
          if(no_p_in_scope) {
            start('p',[],false);
            end('p');
          } else {
            remove_node_if_empty(node);
          }
          return;
        case 'li':
          if(in_scope(tagName)) {
            generate_implied_end_tags(tagName);
          }
          if(in_scope(tagName)) {
            do {
              var node = stack.pop();
            } while(node.tagName.toLowerCase() != tagName);
          }
          return;
        case 'a':
        case 'em':
        case 'strong':
          var node;
          for(var i=active_elements.length; i>0; i--) {
            if(active_elements[i-1].tagName.toLowerCase() == tagName) {
              node = active_elements[i-1];
              break;
            }
          }
          if(typeof(node) == 'undefined' || !in_array(stack, node)) {
            return;
          }
          // Step 2 from the algorithm in the HTML5 spec will never be necessary with the tags we allow
          do {
            var popped_node = stack.pop();
          } while(popped_node != node);
          active_elements.splice(i-1, 1);
          return;
        default:
          var node = current_node();
          if(node.tagName.toLowerCase() == tagName) {
            generate_implied_end_tags();
            while(stack.length > 0 && node != current_node()) {
              stack.pop();
            }
          }
      }
    }
  };
  
  var InTable = {
    insertion_mode_start: function (tagName, attrs, unary) {
      tagName = tagName.toLowerCase();
      switch(tagName) {
        case 'caption':
          clear_stack_to_table_context();
          active_elements.push(insert_html_element_for(tagName, attrs));
          insertion_mode = InCaption;
          return;
        case 'colgroup':
          clear_stack_to_table_context();
          insert_html_element_for(tagName, attrs);
          insertion_mode = InColumnGroup;
          return;
        case 'col':
          start('colgroup');
          start(tagName, attrs, unary);
          return;
        case 'tbody':
        case 'tfoot':
        case 'thead':
          clear_stack_to_table_context();
          insert_html_element_for(tagName, attrs);
          insertion_mode = InTableBody;
          return;
        case 'td':
        case 'th':
        case 'tr':
          start('tbody');
          start(tagName, attrs, unary);
          return;
      };
    },
    
    insertion_mode_end: function (tagName) {
      if(typeof(tagName) == undefined) {
        return;
      }
      tagName = tagName.toLowerCase();
      switch(tagName) {
        case 'table':
          if(in_table_scope('table')) {
            do {
              var node = stack.pop();
            } while(node.tagName.toLowerCase() != 'table');
          }
          reset_insertion_mode();
          return;
      };
    }
  };
  
  var InCaption = {
    insertion_mode_start: function (tagName, attrs, unary) {
      tagName = tagName.toLowerCase();
      switch(tagName) {
        case 'caption':
        case 'col':
        case 'colgroup':
        case 'tbody':
        case 'td':
        case 'tfoot':
        case 'th':
        case 'thead':
        case 'tr':
          end('caption');
          start(tagName);
          return;
        default:
          InBody.insertion_mode_start(tagName, attrs, unary);
          return;
      };
    },
    
    insertion_mode_end: function(tagName) {
      if(typeof(tagName) == undefined) {
        return;
      }
      tagName = tagName.toLowerCase();
      switch(tagName) {
        case 'caption':
          if (in_table_scope('caption')) {
            generate_implied_end_tags();
            if (current_node().tagName.toLowerCase() == 'caption') {
              do {
                node = stack.pop();
              } while(node.tagName.toLowerCase() != 'caption')
              clear_active_elements_to_last_marker();
              insertion_mode = InTable;
            }
          }
          return;
        case "body":
        case "col":
        case "colgroup":
        case "html":
        case "tbody":
        case "td":
        case "tfoot":
        case "th":
        case "thead":
        case "tr":
          return;
        case 'table':
          end('caption');
          end('table');
          return;
        default:
          InBody.insertion_mode_end(tagName);
          return;
      }; 
    }
  };
  
  var InColumnGroup = {
    insertion_mode_start: function (tagName, attrs, unary) {
      tagName = tagName.toLowerCase();
      switch(tagName) {
        case 'html':
          InBody.insertion_mode_start(tagName, attrs, unary);
          return;
        case 'col':
          insert_html_element_for(tagName, attrs);
          stack.pop();
          return;
        default:
          end('colgroup');
          start(tagName);
          return;
      };
    },
    
    insertion_mode_end: function(tagName) {
      if(typeof(tagName) == undefined) {
        return;
      }
      tagName = tagName.toLowerCase();
      switch(tagName) {
        case 'colgroup':
          if(current_node().tagName.toLowerCase() != 'html') {
            stack.pop();
            insertion_mode = InTable;
          }
          return;
        case 'col':
          return;
        default:
          end('colgroup');
          end(tagName);
          return;
      }; 
    }
  };
  
  var InTableBody = {
    insertion_mode_start: function (tagName, attrs, unary) {
      tagName = tagName.toLowerCase();
      switch(tagName) {
        case 'tr':
          clear_stack_to_table_body_context();
          insert_html_element_for(tagName, attrs);
          insertion_mode = InRow;
          return;
        case 'th':
        case 'td':
          start('tr');
          start(tagName, attrs, unary);
          return;
        case "caption":
        case "col":
        case "colgroup":
        case "tbody":
        case "tfoot":
        case "thead":
          if (in_table_scope('tbody') || in_table_scope('thead') || in_table_scope('tfoot')) {
            clear_stack_to_table_body_context();
            end(current_node().tagName.toLowerCase());
            start(tagName, attrs, unary);
          }
          return;
      };
    },
    
    insertion_mode_end: function(tagName) {
      if(typeof(tagName) == undefined) {
        return;
      }
      tagName = tagName.toLowerCase();
      switch(tagName) {
        case 'tbody':
        case 'tfoot':
        case 'thead':
          if (in_table_scope(tagName)) {
            clear_stack_to_table_body_context();
            stack.pop();
            insertion_mode = InTable;
          }
          return;
        case 'table':
          if (in_table_scope('tbody') || in_table_scope('thead') || in_table_scope('tfoot')) {
            clear_stack_to_table_body_context();
            end(current_node().tagName.toLowerCase());
            end(tagName, attrs, unary);
          }
          return;
        case "body":
        case "caption":
        case "col":
        case "colgroup":
        case "html":
        case "td":
        case "th":
        case "tr":
          return;
        default:
          InTable.insertion_mode_end(tagName);
          return;
      }; 
    }
  };
  
  var InRow = {
    insertion_mode_start: function (tagName, attrs, unary) {
      tagName = tagName.toLowerCase();
      switch(tagName) {
        case 'th':
        case 'td':
          clear_stack_to_table_row_context();
          var node = insert_html_element_for(tagName, attrs);
          insertion_mode = InCell;
          active_elements.push(node);
          return;
        case "caption":
        case "col":
        case "colgroup":
        case "tbody":
        case "tfoot":
        case "thead":
        case "tr":
          end('tr');
          start(tagName, attrs, unary);
          return;
        default:
          InTable.insertion_mode_start(tagName, attrs, unary);
          return;
      };
    },
    
    insertion_mode_end: function(tagName) {
      if(typeof(tagName) == undefined) {
        return;
      }
      tagName = tagName.toLowerCase();
      switch(tagName) {
        case 'tr':
          if (in_table_scope(tagName)) {
            clear_stack_to_table_row_context();
            stack.pop();
            insertion_mode = InTableBody;
          }
          return;
        case 'table':
          end('tr');
          start(tagName, attrs, unary);
          return;
        case "tbody":
        case "tfoot":
        case "thead":
          if (in_table_scope(tagName)) {
            end('tr');
            end(tagName);
          }
          return;
        case "body":
        case "caption":
        case "col":
        case "colgroup":
        case "html":
        case "td":
        case "th":
          return;
        default:
          InTable.insertion_mode_end(tagName);
          return;
      }; 
    }
  };
  
  var InCell = {
    insertion_mode_start: function (tagName, attrs, unary) {
      tagName = tagName.toLowerCase();
      switch(tagName) {
        case "caption":
        case "col":
        case "colgroup":
        case "tbody":
        case "td":
        case "tfoot":
        case "th":
        case "thead":
        case "tr":
          if (in_table_scope('td') || in_table_scope('th')) {
            close_the_cell();
            start(tagName, attrs, unary);
          }
          return;
        default:
          InBody.insertion_mode_start(tagName, attrs, unary);
          return;
      };
    },
    
    insertion_mode_end: function(tagName) {
      if(typeof(tagName) == undefined) {
        return;
      }
      tagName = tagName.toLowerCase();
      switch(tagName) {
        case "td":
        case "th":
          if (in_table_scope(tagName)) {
            generate_implied_end_tags();
            if (current_node().tagName.toLowerCase() != tagName) {
              return;
            }
            do {
              var node = stack.pop();
            } while(node.tagName.toLowerCase() != tagName);
            
            clear_active_elements_to_last_marker();
            insertion_mode = InRow;
          }
          return;
        case "body":
        case "caption":
        case "col":
        case "colgroup":
        case "html":
          return;
        case "table":
        case "tbody":
        case "tfoot":
        case "thead":
        case "tr":
          if (in_table_scope(tagName)) {
            close_the_cell();
            end(tagName);
          }
          return;
        default:
          InBody.insertion_mode_end(tagName);
          return;
      }; 
    }
  };

  return {
    purify: function(text) {
      init();
      insertion_mode = InBody;
      try {
        HTMLParser(text, {
          start: start,
          end: end,
          chars: chars
        });
      } catch(e) {
        // We'll do nothing
      }
      result = "";
      for(var i=0, len=root.childNodes.length; i<len; i++) {
        result += XHTMLPrettyPrinter.pretty_print(root.childNodes[i], i>0);
      }
      result = result.replace(/<(\w+)[^>]*>\s*<\/\1\s*>/g, '');
      return result;
    }
  };
}();

/*
 * HTML Parser By John Resig (ejohn.org)
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 *
 */

(function(){

	// Regular Expressions for parsing tags and attributes (modified attribute name matcher, to catch xml:lang)
	var startTag = /^<(\w+\:?\w*)((?:\s+[a-zA-Z_:-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
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
