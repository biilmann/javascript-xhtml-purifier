XHTMLPurifierTestCase = function() {
  var assert = YAHOO.util.Assert;

  return new YAHOO.tool.TestCase({
    name: "XHTMLPurifier Tests",
    setUp: function () {
    },

    tearDown: function () {
    },

    testTables: function () {
      var html = "<table>";
      html += "<caption>Caption</caption>";
      html += "<thead><tr><td>Header</td></tr></thead>";
      html += "<tbody><tr><td>Row</td></tr></tbody>";
      html += "</table>";
      assert.areEqual(html, XHTMLPurifier.purify(html).replace(/\s+/g, ''));
    },
    
    testBadTables: function() {
      var html = "<table>";
      html += "<caption>Caption";
      html += "<thead><th><td>My Header</td></th>";
      html += "<tbody><tr><td>Row</td></tr>";
      html += "</table>";
      //FIXME: Somehow the <tr> in <thead> is followed by two carriage returns 
      var expected = "<table>\n  <caption>\n    Caption\n  </caption>\n";
      expected += "  <thead>\n    <tr>\n      \n      <td>\n        My Header\n      </td>\n    </tr>\n  </thead>\n";
      expected += "  <tbody>\n    <tr>\n      <td>\n        Row\n      </td>\n    </tr>\n  </tbody>\n";
      expected += "</table>";
      
      assert.areEqual(expected, XHTMLPurifier.purify(html));
    },
    
    testSurroundingPs: function() {
      var html = 'this is a test';
      assert.areEqual('<p>\n  this is a test\n</p>', XHTMLPurifier.purify(html));
    },

    testHTMLWithWeirdWordTags: function() {
      var html = '<ol><li><o:p></o:p><span>Hello, World!</span><o:p>&nbsp;</o:p></li></ol>';
      assert.areEqual('<ol>\n  <li>\n    Hello, World!\n  </li>\n</ol>', XHTMLPurifier.purify(html));
    },

    testHTMLWithBoldTags: function() {
      var html = 'Testing <b>some bold</b> and testing';
      assert.areEqual(
          '<p>\n  Testing <strong>some bold</strong> and testing\n</p>',
          XHTMLPurifier.purify(html)
          );
    }
  });
}();

YAHOO.util.Event.onDOMReady(function (){
    //create the logger
    var logger = new YAHOO.tool.TestLogger("testLogger");
    YAHOO.tool.TestRunner.add(XHTMLPurifierTestCase);

    //run the tests
    YAHOO.tool.TestRunner.run();
});


