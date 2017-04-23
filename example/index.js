var data = require('./data');

var config = {
  sitemap: {
    "startUrl": "http://www.zdfans.com/",
    "selectors": [{
      "parentSelectors": ["_root"],
      "type": "SelectorElement",
      "multiple": true,
      "id": "item",
      "selector": "div.content li",
      "delay": ""
    }, {
      "parentSelectors": ["item"],
      "type": "SelectorText",
      "multiple": false,
      "id": "title",
      "selector": "h2 a",
      "regex": "",
      "delay": ""
    }, {
      "parentSelectors": ["item"],
      "type": "SelectorLink",
      "multiple": false,
      "id": "url",
      "selector": "h2 a",
      "delay": ""
    }, {
      "parentSelectors": ["item"],
      "type": "SelectorText",
      "multiple": false,
      "id": "date",
      "selector": "span.time",
      "regex": "\\d+\\-\\d+",
      "delay": "",
      extraFun: function (value) {
        return new Date(new Date().getFullYear() + '-' + value);
      }
    }, {
      "parentSelectors": ["item"],
      "type": "SelectorText",
      "multiple": false,
      "id": "intro",
      "selector": "div.note",
      "regex": "",
      "delay": ""
    }],
    "_id": "zdfans"
  },
  html: data.html,
};

require('../')(config)
  .then(function (data) {
    console.log("dataextractor data", data);
  });