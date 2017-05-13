// init global required
global._ = require('lodash');
global.Deferred = require('jquery-deferred').Deferred;
global.whenCallSequentially = require('./whenCallSequentially');

var cheerio = require('cheerio');

function load(config) {
  var $ = cheerio.load(config.html);

  // copy from Selector/**.js
  var SelectorElement = {

    canReturnMultipleRecords: function () {
      return true;
    },

    canHaveChildSelectors: function () {
      return true;
    },

    canHaveLocalChildSelectors: function () {
      return true;
    },

    canCreateNewJobs: function () {
      return false;
    },
    willReturnElements: function () {
      return true;
    },

    _getData: function (parentElement) {

      var dfd = Deferred();

      var elements = this.getDataElements(parentElement);
      dfd.resolve([].slice.call(elements));

      return dfd.promise();
    },

    getDataColumns: function () {
      return [];
    },

    getFeatures: function () {
      return ['multiple', 'delay']
    }
  };
  var SelectorElementAttribute = {
    canReturnMultipleRecords: function () {
      return true;
    },

    canHaveChildSelectors: function () {
      return false;
    },

    canHaveLocalChildSelectors: function () {
      return false;
    },

    canCreateNewJobs: function () {
      return false;
    },
    willReturnElements: function () {
      return false;
    },
    _getData: function (parentElement) {
      var dfd = Deferred();
      var result = [];
      var data = {};
      data[this.id] = $(parentElement).attr(this.selector);

      result.push(data);

      dfd.resolve(result);

      return dfd.promise();
    },

    getDataColumns: function () {
      return [this.id];
    },

    getFeatures: function () {
      return ['multiple', 'extractAttribute', 'delay']
    }
  };
  var SelectorElementClick = {

    canReturnMultipleRecords: function () {
      return true;
    },

    canHaveChildSelectors: function () {
      return true;
    },

    canHaveLocalChildSelectors: function () {
      return true;
    },

    canCreateNewJobs: function () {
      return false;
    },
    willReturnElements: function () {
      return true;
    },

    getClickElements: function (parentElement) {
      var clickElements = elementQuery(this.clickElementSelector, parentElement);
      return clickElements;
    },

    /**
     * Check whether element is still reachable from html. Useful to check whether the element is removed from DOM.
     * @param element
     */
    isElementInHTML: function (element) {
      return $(element).closest("html").length !== 0;
    },

    getElementCSSSelector: function (element) {

      var nthChild, prev;
      for(nthChild = 1, prev = element.previousElementSibling; prev !== null; prev = prev.previousElementSibling, nthChild++);
      var tagName = element.tagName.toLocaleLowerCase();
      var cssSelector = tagName + ":nth-child(" + nthChild + ")";

      while (element.parentElement) {
        element = element.parentElement;
        var tagName = element.tagName.toLocaleLowerCase();
        if (tagName === 'body' || tagName === 'html') {
          cssSelector = tagName + ">" + cssSelector;
        }
        else {
          for(nthChild = 1, prev = element.previousElementSibling; prev !== null; prev = prev.previousElementSibling, nthChild++);
          cssSelector = tagName + ":nth-child(" + nthChild + ")>" + cssSelector;
        }
      }

      return cssSelector;
    },

    triggerButtonClick: function (clickElement) {

      var cssSelector = this.getElementCSSSelector(clickElement);

      // this function will trigger the click from browser land
      var script = document.createElement("script");
      script.type = "text/javascript";
      script.text = "" +
        "(function(){ " +
        "var el = document.querySelectorAll('" + cssSelector + "')[0]; " +
        "el.click(); " +
        "})();";
      document.body.appendChild(script);
    },

    getClickElementUniquenessType: function () {

      if (this.clickElementUniquenessType === undefined) {
        return 'uniqueText';
      }
      else {
        return this.clickElementUniquenessType;
      }
    },

    _getData: function (parentElement) {

      var delay = parseInt(this.delay) || 0;
      var deferredResponse = Deferred();
      var foundElements = new UniqueElementList('uniqueHTMLText');
      var clickElements = this.getClickElements(parentElement);
      var doneClickingElements = new UniqueElementList(this.getClickElementUniquenessType());

      // add elements that are available before clicking
      var elements = this.getDataElements(parentElement);
      elements.forEach(foundElements.push.bind(foundElements));

      // discard initial elements
      if (this.discardInitialElements) {
        foundElements = new UniqueElementList('uniqueText');
      }

      // no elements to click at the beginning
      if (clickElements.length === 0) {
        deferredResponse.resolve(foundElements);
        return deferredResponse.promise();
      }

      // initial click and wait
      var currentClickElement = clickElements[0];
      this.triggerButtonClick(currentClickElement);
      var nextElementSelection = (new Date()).getTime() + delay;

      // infinitely scroll down and find all items
      var interval = setInterval(function () {

        // find those click elements that are not in the black list
        var allClickElements = this.getClickElements(parentElement);
        clickElements = [];
        allClickElements.forEach(function (element) {
          if (!doneClickingElements.isAdded(element)) {
            clickElements.push(element);
          }
        });

        var now = (new Date()).getTime();
        // sleep. wait when to extract next elements
        if (now < nextElementSelection) {
          //console.log("wait");
          return;
        }

        // add newly found elements to element foundElements array.
        var elements = this.getDataElements(parentElement);
        var addedAnElement = false;
        elements.forEach(function (element) {
          var added = foundElements.push(element);
          if (added) {
            addedAnElement = true;
          }
        });
        //console.log("added", addedAnElement);

        // no new elements found. Stop clicking this button
        if (!addedAnElement) {
          doneClickingElements.push(currentClickElement);
        }

        // continue clicking and add delay, but if there is nothing
        // more to click the finish
        //console.log("total buttons", clickElements.length)
        if (clickElements.length === 0) {
          clearInterval(interval);
          deferredResponse.resolve(foundElements);
        }
        else {
          //console.log("click");
          currentClickElement = clickElements[0];
          // click on elements only once if the type is clickonce
          if (this.clickType === 'clickOnce') {
            doneClickingElements.push(currentClickElement);
          }
          this.triggerButtonClick(currentClickElement);
          nextElementSelection = now + delay;
        }
      }.bind(this), 50);

      return deferredResponse.promise();
    },

    getDataColumns: function () {
      return [];
    },

    getFeatures: function () {
      return ['multiple', 'delay', 'clickElementSelector', 'clickType', 'discardInitialElements', 'clickElementUniquenessType']
    }
  };
  var SelectorElementScroll = {

    canReturnMultipleRecords: function () {
      return true;
    },

    canHaveChildSelectors: function () {
      return true;
    },

    canHaveLocalChildSelectors: function () {
      return true;
    },

    canCreateNewJobs: function () {
      return false;
    },
    willReturnElements: function () {
      return true;
    },
    scrollToBottom: function () {
      window.scrollTo(0, document.body.scrollHeight);
    },
    _getData: function (parentElement) {

      var delay = parseInt(this.delay) || 0;
      var deferredResponse = Deferred();
      var foundElements = [];

      // initially scroll down and wait
      this.scrollToBottom();
      var nextElementSelection = (new Date()).getTime() + delay;

      // infinitely scroll down and find all items
      var interval = setInterval(function () {

        var now = (new Date()).getTime();
        // sleep. wait when to extract next elements
        if (now < nextElementSelection) {
          return;
        }

        var elements = this.getDataElements(parentElement);
        // no new elements found
        if (elements.length === foundElements.length) {
          clearInterval(interval);
          deferredResponse.resolve(jQuery.makeArray(elements));
        }
        else {
          // continue scrolling and add delay
          foundElements = elements;
          this.scrollToBottom();
          nextElementSelection = now + delay;
        }

      }.bind(this), 50);

      return deferredResponse.promise();
    },

    getDataColumns: function () {
      return [];
    },

    getFeatures: function () {
      return ['multiple', 'delay']
    }
  };
  var SelectorGroup = {

    canReturnMultipleRecords: function () {
      return false;
    },

    canHaveChildSelectors: function () {
      return false;
    },

    canHaveLocalChildSelectors: function () {
      return false;
    },

    canCreateNewJobs: function () {
      return false;
    },
    willReturnElements: function () {
      return false;
    },
    _getData: function (parentElement) {

      var dfd = Deferred();

      // cannot reuse this.getDataElements because it depends on *multiple* property
      var elements = $(this.selector, parentElement);

      var records = [];
      $(elements).each(function (k, element) {
        var data = {};

        data[this.id] = $(element).text();

        if (this.extractAttribute) {
          data[this.id + '-' + this.extractAttribute] = $(element).attr(this.extractAttribute);
        }

        records.push(data);
      }.bind(this));

      var result = {};
      result[this.id] = records;

      dfd.resolve([result]);
      return dfd.promise();
    },

    getDataColumns: function () {
      return [this.id];
    },

    getFeatures: function () {
      return ['delay', 'extractAttribute']
    }
  };
  var SelectorHTML = {

    canReturnMultipleRecords: function () {
      return true;
    },

    canHaveChildSelectors: function () {
      return false;
    },

    canHaveLocalChildSelectors: function () {
      return false;
    },

    canCreateNewJobs: function () {
      return false;
    },
    willReturnElements: function () {
      return false;
    },
    _getData: function (parentElement) {

      var dfd = Deferred();

      var elements = this.getDataElements(parentElement);

      var result = [];
      $(elements).each(function (k, element) {
        var data = {};
        var html = $(element).html();

        if (this.regex !== undefined && this.regex.length) {
          var matches = html.match(new RegExp(this.regex));
          if (matches !== null) {
            html = matches[0];
          }
          else {
            html = null;
          }
        }
        data[this.id] = html;

        result.push(data);
      }.bind(this));

      if (this.multiple === false && elements.length === 0) {
        var data = {};
        data[this.id] = null;
        result.push(data);
      }

      dfd.resolve(result);
      return dfd.promise();
    },

    getDataColumns: function () {
      return [this.id];
    },

    getFeatures: function () {
      return ['multiple', 'regex', 'delay']
    }
  };
  var SelectorImage = {
    canReturnMultipleRecords: function () {
      return true;
    },

    canHaveChildSelectors: function () {
      return false;
    },

    canHaveLocalChildSelectors: function () {
      return false;
    },

    canCreateNewJobs: function () {
      return false;
    },
    willReturnElements: function () {
      return false;
    },
    _getData: function (parentElement) {

      var dfd = Deferred();

      var elements = this.getDataElements(parentElement);

      var deferredDataCalls = [];
      $(elements).each(function (i, element) {
        deferredDataCalls.push(function () {

          var deferredData = Deferred();

          var data = {};
          data[this.id] = $(element).attr('src');

          deferredData.resolve(data);
          return deferredData.promise();
        }.bind(this));
      }.bind(this));

      whenCallSequentially(deferredDataCalls).done(function (dataResults) {

        if (this.multiple === false && elements.length === 0) {
          var data = {};
          data[this.id + '-src'] = null;
          dataResults.push(data);
        }

        dfd.resolve(dataResults);
      });

      return dfd.promise();
    },
    getDataColumns: function () {
      return [this.id + '-src'];
    },

    getFeatures: function () {
      return ['multiple', 'delay']
    },

    getItemCSSSelector: function () {
      return "img";
    }
  };
  var SelectorLink = {
    canReturnMultipleRecords: function () {
      return true;
    },

    canHaveChildSelectors: function () {
      return true;
    },

    canHaveLocalChildSelectors: function () {
      return false;
    },

    canCreateNewJobs: function () {
      return true;
    },
    willReturnElements: function () {
      return false;
    },
    _getData: function (parentElement) {
      var elements = this.getDataElements(parentElement);

      var dfd = Deferred();

      // return empty record if not multiple type and no elements found
      if (this.multiple === false && elements.length === 0) {
        var data = {};
        data[this.id] = null;
        dfd.resolve([data]);
        return dfd;
      }

      // extract links one by one
      var deferredDataExtractionCalls = [];
      $(elements).each(function (k, element) {

        deferredDataExtractionCalls.push(function (element) {

          var deferredData = Deferred();

          var data = {};
          data[this.id] = $(element).attr('href');
          deferredData.resolve(data);

          return deferredData;
        }.bind(this, element));
      }.bind(this));

      whenCallSequentially(deferredDataExtractionCalls).done(function (responses) {
        var result = [];
        responses.forEach(function (dataResult) {
          result.push(dataResult);
        });
        dfd.resolve(result);
      });

      return dfd.promise();
    },

    getDataColumns: function () {
      return [this.id, this.id + '-href'];
    },

    getFeatures: function () {
      return ['multiple', 'delay']
    },

    getItemCSSSelector: function () {
      return "a";
    }
  };
  var SelectorPopupLink = {
    canReturnMultipleRecords: function () {
      return true;
    },

    canHaveChildSelectors: function () {
      return true;
    },

    canHaveLocalChildSelectors: function () {
      return false;
    },

    canCreateNewJobs: function () {
      return true;
    },
    willReturnElements: function () {
      return false;
    },
    _getData: function (parentElement) {
      var elements = this.getDataElements(parentElement);

      var dfd = Deferred();

      // return empty record if not multiple type and no elements found
      if (this.multiple === false && elements.length === 0) {
        var data = {};
        data[this.id] = null;
        dfd.resolve([data]);
        return dfd;
      }

      // extract links one by one
      var deferredDataExtractionCalls = [];
      $(elements).each(function (k, element) {

        deferredDataExtractionCalls.push(function (element) {

          var deferredData = Deferred();

          var data = {};
          data[this.id] = $(element).text();
          data._followSelectorId = this.id;

          var deferredPopupURL = this.getPopupURL(element);
          deferredPopupURL.done(function (url) {
            data[this.id + '-href'] = url;
            data._follow = url;
            deferredData.resolve(data);
          }.bind(this));

          return deferredData;
        }.bind(this, element));
      }.bind(this));

      whenCallSequentially(deferredDataExtractionCalls).done(function (responses) {
        var result = [];
        responses.forEach(function (dataResult) {
          result.push(dataResult);
        });
        dfd.resolve(result);
      });

      return dfd.promise();
    },

    getElementCSSSelector: function (element) {

      var nthChild, prev;
      for(nthChild = 1, prev = element.previousElementSibling; prev !== null; prev = prev.previousElementSibling, nthChild++);
      var tagName = element.tagName.toLocaleLowerCase();
      var cssSelector = tagName + ":nth-child(" + nthChild + ")";

      while (element.parentElement) {
        element = element.parentElement;
        var tagName = element.tagName.toLocaleLowerCase();
        if (tagName === 'body' || tagName === 'html') {
          cssSelector = tagName + ">" + cssSelector;
        }
        else {
          for(nthChild = 1, prev = element.previousElementSibling; prev !== null; prev = prev.previousElementSibling, nthChild++);
          cssSelector = tagName + ":nth-child(" + nthChild + ")>" + cssSelector;
        }
      }

      return cssSelector;
    },

    /**
     * Gets an url from a window.open call by mocking the window.open function
     * @param element
     * @returns Deferred()
     */
    getPopupURL: function (element) {

      // override window.open function. we need to execute this in page scope.
      // we need to know how to find this element from page scope.
      var cssSelector = this.getElementCSSSelector(element);

      // this function will catch window.open call and place the requested url as the elements data attribute
      var script = document.createElement("script");
      script.type = "text/javascript";
      script.text = "" +
        "(function(){ " +
        "var open = window.open; " +
        "var el = document.querySelectorAll('" + cssSelector + "')[0]; " +
        "var openNew = function() { " +
        "var url = arguments[0]; " +
        "el.dataset.webScraperExtractUrl = url; " +
        "window.open = open; " +
        "};" +
        "window.open = openNew; " +
        "el.click(); " +
        "})();";
      document.body.appendChild(script);

      // wait for url to be available
      var deferredURL = Deferred();
      var timeout = Math.abs(5000 / 30); // 5s timeout to generate an url for popup
      var interval = setInterval(function () {
        var url = $(element).data("web-scraper-extract-url");
        if (url) {
          deferredURL.resolve(url);
          clearInterval(interval);
          script.remove();
        }
        // timeout popup opening
        if (timeout-- <= 0) {
          clearInterval(interval);
          script.remove();
        }
      }, 30);

      return deferredURL.promise();
    },

    getDataColumns: function () {
      return [this.id, this.id + '-href'];
    },

    getFeatures: function () {
      return ['multiple', 'delay']
    },

    getItemCSSSelector: function () {
      return "*";
    }
  };
  var SelectorTable = {

    canReturnMultipleRecords: function () {
      return true;
    },

    canHaveChildSelectors: function () {
      return false;
    },

    canHaveLocalChildSelectors: function () {
      return false;
    },

    canCreateNewJobs: function () {
      return false;
    },
    willReturnElements: function () {
      return false;
    },
    getTableHeaderColumns: function ($table) {
      var columns = {};
      var headerRowSelector = this.getTableHeaderRowSelector();
      var $headerRow = $table.find(headerRowSelector);
      if ($headerRow.length > 0) {
        $headerRow.find("td,th").each(function (i) {
          var header = $(this).text().trim();
          columns[header] = {
            index: i + 1
          };
        });
      }
      return columns;
    },
    _getData: function (parentElement) {

      var dfd = Deferred();

      var tables = this.getDataElements(parentElement);

      var result = [];
      $(tables).each(function (k, table) {

        var columns = this.getTableHeaderColumns($(table));

        var dataRowSelector = this.getTableDataRowSelector();
        $(table).find(dataRowSelector).each(function (i, row) {
          var data = {};
          this.columns.forEach(function (column) {
            if (column.extract === true) {
              if (columns[column.header] === undefined) {
                data[column.name] = null;
              }
              else {
                var rowText = $(row).find(">:nth-child(" + columns[column.header].index + ")").text().trim();
                data[column.name] = rowText;
              }
            }
          });
          result.push(data);
        }.bind(this));
      }.bind(this));

      dfd.resolve(result);
      return dfd.promise();
    },

    getDataColumns: function () {

      var dataColumns = [];
      this.columns.forEach(function (column) {
        if (column.extract === true) {
          dataColumns.push(column.name);
        }
      });
      return dataColumns;
    },

    getFeatures: function () {
      return ['multiple', 'columns', 'delay', 'tableDataRowSelector', 'tableHeaderRowSelector']
    },

    getItemCSSSelector: function () {
      return "table";
    },

    getTableHeaderRowSelectorFromTableHTML: function (html) {

      var $table = $(html);
      if ($table.find("thead tr:has(td:not(:empty)), thead tr:has(th:not(:empty))").length) {

        if ($table.find("thead tr").length === 1) {
          return "thead tr";
        }
        else {
          var $rows = $table.find("thead tr");
          // first row with data
          var rowIndex = $rows.index($rows.filter(":has(td:not(:empty)),:has(th:not(:empty))")[0]);
          return "thead tr:nth-of-type(" + (rowIndex + 1) + ")";
        }
      }
      else if ($table.find("tr td:not(:empty), tr th:not(:empty)").length) {
        var $rows = $table.find("tr");
        // first row with data
        var rowIndex = $rows.index($rows.filter(":has(td:not(:empty)),:has(th:not(:empty))")[0]);
        return "tr:nth-of-type(" + (rowIndex + 1) + ")";
      }
      else {
        return "";
      }
    },

    getTableDataRowSelectorFromTableHTML: function (html) {

      var $table = $(html);
      if ($table.find("thead tr:has(td:not(:empty)), thead tr:has(th:not(:empty))").length) {

        return "tbody tr";
      }
      else if ($table.find("tr td:not(:empty), tr th:not(:empty)").length) {
        var $rows = $table.find("tr");
        // first row with data
        var rowIndex = $rows.index($rows.filter(":has(td:not(:empty)),:has(th:not(:empty))")[0]);
        return "tr:nth-of-type(n+" + (rowIndex + 2) + ")";
      }
      else {
        return "";
      }
    },

    getTableHeaderRowSelector: function () {

      // handle legacy selectors
      if (this.tableHeaderRowSelector === undefined) {
        return "thead tr";
      }
      else {
        return this.tableHeaderRowSelector;
      }
    },

    getTableDataRowSelector: function () {

      // handle legacy selectors
      if (this.tableDataRowSelector === undefined) {
        return "tbody tr";
      }
      else {
        return this.tableDataRowSelector;
      }
    },

    /**
     * Extract table header column info from html
     * @param html
     */
    getTableHeaderColumnsFromHTML: function (headerRowSelector, html) {

      var $table = $(html);
      var $headerRowColumns = $table.find(headerRowSelector).find("td,th");

      var columns = [];

      $headerRowColumns.each(function (i, columnEl) {
        var header = $(columnEl).text().trim();
        var name = header;
        if (header.length !== 0) {
          columns.push({
            header: header,
            name: name,
            extract: true
          });
        }
      });
      return columns;
    }
  };
  var SelectorText = {

    canReturnMultipleRecords: function () {
      return true;
    },

    canHaveChildSelectors: function () {
      return false;
    },

    canHaveLocalChildSelectors: function () {
      return false;
    },

    canCreateNewJobs: function () {
      return false;
    },
    willReturnElements: function () {
      return false;
    },
    _getData: function (parentElement) {

      var dfd = Deferred();

      var elements = this.getDataElements(parentElement);

      var result = [];
      $(elements).each(function (k, element) {
        var data = {};

        // remove script, style tag contents from text results
        var $element_clone = $(element).clone();
        $element_clone.find("script, style").remove();
        // <br> replace br tags with newlines
        $element_clone.find("br").after("\n");

        var text = $element_clone.text();
        if (this.regex !== undefined && this.regex.length) {
          var matches = text.match(new RegExp(this.regex));
          if (matches !== null) {
            text = matches[0];
          }
          else {
            text = null;
          }
        }
        data[this.id] = text;
        
        if(this.extraFun && typeof this.extraFun === 'function') {
          data[this.id] = this.extraFun(text);
        }

        result.push(data);
      }.bind(this));

      if (this.multiple === false && elements.length === 0) {
        var data = {};
        data[this.id] = null;
        result.push(data);
      }

      dfd.resolve(result);
      return dfd.promise();
    },

    getDataColumns: function () {
      return [this.id];
    },

    getFeatures: function () {
      return ['multiple', 'regex', 'delay', 'extraFun']
    }
  };


  // add slectors map
  var selectors = {
    SelectorElement: SelectorElement,
    SelectorElementAttribute: SelectorElementAttribute,
    SelectorElementClick: SelectorElementClick,
    SelectorElementScroll: SelectorElementScroll,
    SelectorGroup: SelectorGroup,
    SelectorHTML: SelectorHTML,
    SelectorImage: SelectorImage,
    SelectorLink: SelectorLink,
    SelectorPopupLink: SelectorPopupLink,
    SelectorTable: SelectorTable,
    SelectorText: SelectorText,
  };


  // copy from elementQuery
  function elementQuery(CSSSelector, parentElement) {

    CSSSelector = CSSSelector || "";

    var selectedElements = [];

    var addElement = function (element) {
      if (selectedElements.indexOf(element) === -1) {
        selectedElements.push(element);
      }
    };

    var selectorParts = elementQuery.getSelectorParts(CSSSelector);
    selectorParts.forEach(function (selector) {

      // handle special case when parent is selected
      if (selector === "_parent_") {
        $(parentElement).each(function (i, element) {
          addElement(element);
        });
      }
      else {
        var elements = $(selector, parentElement);
        elements.each(function (i, element) {
          addElement(element);
        });
      }
    });

    return selectedElements;
  };
  elementQuery.getSelectorParts = function (CSSSelector) {

    var selectors = CSSSelector.split(/(,|".*?"|'.*?'|\(.*?\))/);

    var resultSelectors = [];
    var currentSelector = "";
    selectors.forEach(function (selector) {
      if (selector === ',') {
        if (currentSelector.trim().length) {
          resultSelectors.push(currentSelector.trim());
        }
        currentSelector = "";
      }
      else {
        currentSelector += selector;
      }
    });
    if (currentSelector.trim().length) {
      resultSelectors.push(currentSelector.trim());
    }

    return resultSelectors;
  };


  // copy from Selector
  var Selector = function (selector) {
    this.updateData(selector);
    this.initType();
  };
  Selector.prototype = {

    /**
     * Is this selector configured to return multiple items?
     * @returns {boolean}
     */
    willReturnMultipleRecords: function () {
      return this.canReturnMultipleRecords() && this.multiple;
    },

    /**
     * Update current selector configuration
     * @param data
     */
    updateData: function (data) {
      var allowedKeys = ['id', 'type', 'selector', 'parentSelectors'];
      allowedKeys = allowedKeys.concat(selectors[data.type].getFeatures());

      // update data
      for(var key in data) {
        if (allowedKeys.indexOf(key) !== -1 || typeof data[key] === 'function') {
          this[key] = data[key];
        }
      }

      // remove values that are not needed for this type of selector
      for(var key in this) {
        if (allowedKeys.indexOf(key) === -1 && typeof this[key] !== 'function') {
          delete this[key];
        }
      }
    },

    /**
     * CSS selector which will be used for element selection
     * @returns {string}
     */
    getItemCSSSelector: function () {
      return "*";
    },

    /**
     * override objects methods based on seletor type
     */
    initType: function () {

      if (selectors[this.type] === undefined) {
        throw "Selector type not defined " + this.type;
      }

      // overrides objects methods
      for(var i in selectors[this.type]) {
        this[i] = selectors[this.type][i];
      }
    },

    /**
     * Check whether a selector is a paren selector of this selector
     * @param selectorId
     * @returns {boolean}
     */
    hasParentSelector: function (selectorId) {
      return (this.parentSelectors.indexOf(selectorId) !== -1);
    },

    removeParentSelector: function (selectorId) {
      var index = this.parentSelectors.indexOf(selectorId);
      if (index !== -1) {
        this.parentSelectors.splice(index, 1);
      }
    },

    renameParentSelector: function (originalId, replacementId) {
      if (this.hasParentSelector(originalId)) {
        var pos = this.parentSelectors.indexOf(originalId);
        this.parentSelectors.splice(pos, 1, replacementId);
      }
    },

    getDataElements: function (parentElement) {

      var elements = elementQuery(this.selector, parentElement);
      if (this.multiple) {
        return elements;
      }
      else if (elements.length > 0) {
        return [elements[0]];
      }
      else {
        return [];
      }
    },

    getData: function (parentElement) {

      var d = Deferred();
      var timeout = this.delay || 0;

      // this works much faster because whenCallSequentially isn't running next data extraction immediately
      if (timeout === 0) {
        var deferredData = this._getData(parentElement);
        deferredData.done(function (data) {
          d.resolve(data);
        });
      }
      else {
        setTimeout(function () {
          var deferredData = this._getData(parentElement);
          deferredData.done(function (data) {
            d.resolve(data);
          });
        }.bind(this), timeout);
      }

      return d.promise();
    }
  };

  // copy from SelectorList
  var SelectorList = function (selectors) {

    if (selectors === undefined) {
      return;
    }

    for(var i = 0; i < selectors.length; i++) {
      this.push(selectors[i]);
    }
  };

  SelectorList.prototype = new Array;

  SelectorList.prototype.push = function (selector) {

    if (!this.hasSelector(selector.id)) {
      if (!(selector instanceof Selector)) {
        selector = new Selector(selector);
      }
      Array.prototype.push.call(this, selector);
    }
  };

  SelectorList.prototype.hasSelector = function (selectorId) {

    if (selectorId instanceof Object) {
      selectorId = selectorId.id;
    }

    for(var i = 0; i < this.length; i++) {
      if (this[i].id === selectorId) {
        return true;
      }
    }
    return false;
  };

  /**
   * Returns all selectors or recursively find and return all child selectors of a parent selector.
   * @param parentSelectorId
   * @returns {Array}
   */
  SelectorList.prototype.getAllSelectors = function (parentSelectorId) {

    if (parentSelectorId === undefined) {
      return this;
    }

    var getAllChildSelectors = function (parentSelectorId, resultSelectors) {
      this.forEach(function (selector) {
        if (selector.hasParentSelector(parentSelectorId)) {
          if (resultSelectors.indexOf(selector) === -1) {
            resultSelectors.push(selector);
            getAllChildSelectors(selector.id, resultSelectors);
          }
        }
      }.bind(this));
    }.bind(this);

    var resultSelectors = [];
    getAllChildSelectors(parentSelectorId, resultSelectors);
    return resultSelectors;
  };

  /**
   * Returns only selectors that are directly under a parent
   * @param parentSelectorId
   * @returns {Array}
   */
  SelectorList.prototype.getDirectChildSelectors = function (parentSelectorId) {
    var resultSelectors = new SelectorList();
    this.forEach(function (selector) {
      if (selector.hasParentSelector(parentSelectorId)) {
        resultSelectors.push(selector);
      }
    });
    return resultSelectors;
  };

  SelectorList.prototype.clone = function () {
    var resultList = new SelectorList();
    this.forEach(function (selector) {
      resultList.push(selector);
    });
    return resultList;
  };

  SelectorList.prototype.fullClone = function () {
    var resultList = new SelectorList();
    this.forEach(function (selector) {
      resultList.push(JSON.parse(JSON.stringify(selector)));
    });
    return resultList;
  };

  SelectorList.prototype.concat = function () {
    var resultList = this.clone();
    for(var i in arguments) {
      arguments[i].forEach(function (selector) {
        resultList.push(selector);
      }.bind(this));
    }
    return resultList;
  };

  SelectorList.prototype.getSelector = function (selectorId) {
    for(var i = 0; i < this.length; i++) {
      var selector = this[i];
      if (selector.id === selectorId) {
        return selector;
      }
    }
  };

  /**
   * Returns all selectors if this selectors including all parent selectors within this page
   * @TODO not used any more.
   * @param selectorId
   * @returns {*}
   */
  SelectorList.prototype.getOnePageSelectors = function (selectorId) {
    var resultList = new SelectorList();
    var selector = this.getSelector(selectorId);
    resultList.push(this.getSelector(selectorId));

    // recursively find all parent selectors that could lead to the page where selectorId is used.
    var findParentSelectors = function (selector) {

      selector.parentSelectors.forEach(function (parentSelectorId) {

        if (parentSelectorId === "_root") return;
        var parentSelector = this.getSelector(parentSelectorId);
        if (resultList.indexOf(parentSelector) !== -1) return;
        if (parentSelector.willReturnElements()) {
          resultList.push(parentSelector);
          findParentSelectors(parentSelector);
        }
      }.bind(this));
    }.bind(this);

    findParentSelectors(selector);

    // add all child selectors
    resultList = resultList.concat(this.getSinglePageAllChildSelectors(selector.id));
    return resultList;
  };

  /**
   * Returns all child selectors of a selector which can be used within one page.
   * @param parentSelectorId
   */
  SelectorList.prototype.getSinglePageAllChildSelectors = function (parentSelectorId) {

    var resultList = new SelectorList();
    var addChildSelectors = function (parentSelector) {
      if (parentSelector.willReturnElements()) {
        var childSelectors = this.getDirectChildSelectors(parentSelector.id);
        childSelectors.forEach(function (childSelector) {
          if (resultList.indexOf(childSelector) === -1) {
            resultList.push(childSelector);
            addChildSelectors(childSelector);
          }
        }.bind(this));
      }
    }.bind(this);

    var parentSelector = this.getSelector(parentSelectorId);
    addChildSelectors(parentSelector);
    return resultList;
  };

  SelectorList.prototype.willReturnMultipleRecords = function (selectorId) {

    // handle reuqested selector
    var selector = this.getSelector(selectorId);
    if (selector.willReturnMultipleRecords() === true) {
      return true;
    }

    // handle all its child selectors
    var childSelectors = this.getAllSelectors(selectorId);
    for(var i = 0; i < childSelectors.length; i++) {
      var selector = childSelectors[i];
      if (selector.willReturnMultipleRecords() === true) {
        return true;
      }
    }

    return false;
  };

  /**
   * When serializing to JSON convert to an array
   * @returns {Array}
   */
  SelectorList.prototype.toJSON = function () {
    var result = [];
    this.forEach(function (selector) {
      result.push(selector);
    });
    return result;
  };

  SelectorList.prototype.getSelectorById = function (selectorId) {
    for(var i = 0; i < this.length; i++) {
      var selector = this[i];
      if (selector.id === selectorId) {
        return selector;
      }
    }
  };

  /**
   * returns css selector for a given element. css selector includes all parent element selectors
   * @param selectorId
   * @param parentSelectorIds array of parent selector ids from devtools Breadcumb
   * @returns string
   */
  SelectorList.prototype.getCSSSelectorWithinOnePage = function (selectorId, parentSelectorIds) {

    var CSSSelector = this.getSelector(selectorId).selector;
    var parentCSSSelector = this.getParentCSSSelectorWithinOnePage(parentSelectorIds);
    CSSSelector = parentCSSSelector + CSSSelector;

    return CSSSelector;
  };

  /**
   * returns css selector for parent selectors that are within one page
   * @param parentSelectorIds array of parent selector ids from devtools Breadcumb
   * @returns string
   */
  SelectorList.prototype.getParentCSSSelectorWithinOnePage = function (parentSelectorIds) {

    var CSSSelector = "";

    for(var i = parentSelectorIds.length - 1; i > 0; i--) {

      var parentSelectorId = parentSelectorIds[i];
      var parentSelector = this.getSelector(parentSelectorId);
      if (parentSelector.willReturnElements()) {
        CSSSelector = parentSelector.selector + " " + CSSSelector;
      }
      else {
        break;
      }
    }

    return CSSSelector;
  };

  SelectorList.prototype.hasRecursiveElementSelectors = function () {

    var RecursionFound = false;

    this.forEach(function (topSelector) {
      var visitedSelectors = [];

      var checkRecursion = function (parentSelector) {

        // already visited
        if (visitedSelectors.indexOf(parentSelector) !== -1) {
          RecursionFound = true;
          return;
        }

        if (parentSelector.willReturnElements()) {
          visitedSelectors.push(parentSelector);
          var childSelectors = this.getDirectChildSelectors(parentSelector.id);
          childSelectors.forEach(checkRecursion);
          visitedSelectors.pop();
        }
      }.bind(this);

      checkRecursion(topSelector);

    }.bind(this));

    return RecursionFound;
  };


  // copy from Sitemap
  var Sitemap = function (sitemapObj) {
    this.initData(sitemapObj);
  };

  Sitemap.prototype = {

    initData: function (sitemapObj) {
      for(var key in sitemapObj) {
        this[key] = sitemapObj[key];
      }

      var selectors = this.selectors;
      this.selectors = new SelectorList(this.selectors);
    },

    /**
     * Returns all selectors or recursively find and return all child selectors of a parent selector.
     * @param parentSelectorId
     * @returns {Array}
     */
    getAllSelectors: function (parentSelectorId) {

      return this.selectors.getAllSelectors(parentSelectorId);
    },

    /**
     * Returns only selectors that are directly under a parent
     * @param parentSelectorId
     * @returns {Array}
     */
    getDirectChildSelectors: function (parentSelectorId) {
      return this.selectors.getDirectChildSelectors(parentSelectorId);
    },

    /**
     * Returns all selector id parameters
     * @returns {Array}
     */
    getSelectorIds: function () {
      var ids = ['_root'];
      this.selectors.forEach(function (selector) {
        ids.push(selector.id);
      });
      return ids;
    },

    /**
     * Returns only selector ids which can have child selectors
     * @returns {Array}
     */
    getPossibleParentSelectorIds: function () {
      var ids = ['_root'];
      this.selectors.forEach(function (selector) {
        if (selector.canHaveChildSelectors()) {
          ids.push(selector.id);
        }
      }.bind(this));
      return ids;
    },

    getStartUrls: function () {

      var startUrls = this.startUrl;
      // single start url
      if (this.startUrl.push === undefined) {
        startUrls = [startUrls];
      }

      var urls = [];
      startUrls.forEach(function (startUrl) {

        // zero padding helper
        var lpad = function (str, length) {
          while (str.length < length)
            str = "0" + str;
          return str;
        };

        var re = /^(.*?)\[(\d+)\-(\d+)(:(\d+))?\](.*)$/;
        var matches = startUrl.match(re);
        if (matches) {
          var startStr = matches[2];
          var endStr = matches[3];
          var start = parseInt(startStr);
          var end = parseInt(endStr);
          var incremental = 1;
          console.log(matches[5]);
          if (matches[5] !== undefined) {
            incremental = parseInt(matches[5]);
          }
          for(var i = start; i <= end; i += incremental) {

            // with zero padding
            if (startStr.length === endStr.length) {
              urls.push(matches[1] + lpad(i.toString(), startStr.length) + matches[6]);
            }
            else {
              urls.push(matches[1] + i + matches[6]);
            }
          }
          return urls;
        }
        else {
          urls.push(startUrl);
        }
      });

      return urls;
    },

    updateSelector: function (selector, selectorData) {

      // selector is undefined when creating a new one
      if (selector === undefined) {
        selector = new Selector(selectorData);
      }

      // update child selectors
      if (selector.id !== undefined && selector.id !== selectorData.id) {
        this.selectors.forEach(function (currentSelector) {
          currentSelector.renameParentSelector(selector.id, selectorData.id)
        });

        // update cyclic selector
        var pos = selectorData.parentSelectors.indexOf(selector.id);
        if (pos !== -1) {
          selectorData.parentSelectors.splice(pos, 1, selectorData.id);
        }
      }

      selector.updateData(selectorData);

      if (this.getSelectorIds().indexOf(selector.id) === -1) {
        this.selectors.push(selector);
      }
    },
    deleteSelector: function (selectorToDelete) {

      this.selectors.forEach(function (selector) {
        if (selector.hasParentSelector(selectorToDelete.id)) {
          selector.removeParentSelector(selectorToDelete.id);
          if (selector.parentSelectors.length === 0) {
            this.deleteSelector(selector)
          }
        }
      }.bind(this));

      for(var i in this.selectors) {
        if (this.selectors[i].id === selectorToDelete.id) {
          this.selectors.splice(i, 1);
          break;
        }
      }
    },
    getDataTableId: function () {
      return this._id.replace(/\./g, '_');
    },
    exportSitemap: function () {
      var sitemapObj = JSON.parse(JSON.stringify(this));
      delete sitemapObj._rev;
      return JSON.stringify(sitemapObj);
    },
    importSitemap: function (sitemapJSON) {
      var sitemapObj = JSON.parse(sitemapJSON);
      this.initData(sitemapObj);
    },
    // return a list of columns than can be exported
    getDataColumns: function () {
      var columns = [];
      this.selectors.forEach(function (selector) {

        columns = columns.concat(selector.getDataColumns());
      });

      return columns;
    },
    getDataExportCsvBlob: function (data) {

      var columns = this.getDataColumns(),
        delimiter = ',',
        newline = "\n",
        csvData = ['\ufeff']; // utf-8 bom char

      // header
      csvData.push(columns.join(delimiter) + newline)

      // data
      data.forEach(function (row) {
        var rowData = [];
        columns.forEach(function (column) {
          var cellData = row[column];
          if (cellData === undefined) {
            cellData = "";
          }
          else if (typeof cellData === 'object') {
            cellData = JSON.stringify(cellData);
          }

          rowData.push('"' + cellData.replace(/"/g, '""').trim() + '"');
        });
        csvData.push(rowData.join(delimiter) + newline);
      });

      return new Blob(csvData, { type: 'text/csv' });
    },
    getSelectorById: function (selectorId) {
      return this.selectors.getSelectorById(selectorId);
    },
    /**
     * Create full clone of sitemap
     * @returns {Sitemap}
     */
    clone: function () {
      var clonedJSON = JSON.parse(JSON.stringify(this));
      var sitemap = new Sitemap(clonedJSON);
      return sitemap;
    }
  };

  // copy from DataExtractor
  DataExtractor = function (options) {

    if (options.sitemap instanceof Sitemap) {
      this.sitemap = options.sitemap;
    }
    else {
      this.sitemap = new Sitemap(options.sitemap);
    }

    this.parentSelectorId = options.parentSelectorId;
    this.parentElement = options.parentElement || $("html")[0];
  };

  DataExtractor.prototype = {

    /**
     * Returns a list of independent selector lists. follow=true splits selectors in trees.
     * Two side by side type=multiple selectors split trees.
     */
    findSelectorTrees: function () {
      return this._findSelectorTrees(this.parentSelectorId, new SelectorList());
    },

    /**
     * the selector cannot return multiple records and it also cannot create new jobs. Also all of its child selectors
     * must have the same features
     * @param selector
     * @returns {boolean}
     */
    selectorIsCommonToAllTrees: function (selector) {
      // selectors which return mutiple items cannot be common to all
      // selectors
      if (selector.willReturnMultipleRecords()) {
        return false;
      }

      // Link selectors which will follow to a new page also cannot be common
      // to all selectors
      if (selector.canCreateNewJobs()
        && this.sitemap.getDirectChildSelectors(selector.id).length > 0) {
        return false;
      }

      // also all child selectors must have the same features
      var childSelectors = this.sitemap.getAllSelectors(selector.id);
      for (var i in childSelectors) {
        var childSelector = childSelectors[i];
        if (!this.selectorIsCommonToAllTrees(childSelector)) {
          return false;
        }
      }
      return true;
    },

    getSelectorsCommonToAllTrees: function (parentSelectorId) {
      var commonSelectors = [];
      var childSelectors = this.sitemap.getDirectChildSelectors(parentSelectorId);

      childSelectors.forEach(function (childSelector) {
        if (this.selectorIsCommonToAllTrees(childSelector)) {
          commonSelectors.push(childSelector);
          // also add all child selectors which. Child selectors were also checked

          var selectorChildSelectors = this.sitemap.getAllSelectors(childSelector.id);
          selectorChildSelectors.forEach(function (selector) {
            if (commonSelectors.indexOf(selector) === -1) {
              commonSelectors.push(selector);
            }
          });

        }
      }.bind(this));

      return commonSelectors;
    },

    _findSelectorTrees: function (parentSelectorId, commonSelectorsFromParent) {

      var commonSelectors = commonSelectorsFromParent.concat(this.getSelectorsCommonToAllTrees(parentSelectorId));

      // find selectors that will be making a selector tree
      var selectorTrees = [];
      var childSelectors = this.sitemap.getDirectChildSelectors(parentSelectorId);
      childSelectors.forEach(function (selector) {
        if (!this.selectorIsCommonToAllTrees(selector)) {
          // this selector will be making a new selector tree. But this selector might contain some child
          // selectors that are making more trees so here should be a some kind of seperation for that
          if (!selector.canHaveLocalChildSelectors()) {
            var selectorTree = commonSelectors.concat([selector]);
            selectorTrees.push(selectorTree);
          }
          else {
            // find selector tree within this selector
            var commonSelectorsFromParent = commonSelectors.concat([selector]);
            var childSelectorTrees = this._findSelectorTrees(selector.id, commonSelectorsFromParent);
            selectorTrees = selectorTrees.concat(childSelectorTrees);
          }
        }
      }.bind(this));

      // it there were not any selectors that make a separate tree then all common selectors make up a single selector tree
      if (selectorTrees.length === 0) {
        return [commonSelectors];
      }
      else {
        return selectorTrees;
      }
    },

    getSelectorTreeCommonData: function (selectors, parentSelectorId, parentElement) {

      var childSelectors = selectors.getDirectChildSelectors(parentSelectorId);
      var deferredDataCalls = [];
      childSelectors.forEach(function (selector) {
        if (!selectors.willReturnMultipleRecords(selector.id)) {
          deferredDataCalls.push(this.getSelectorCommonData.bind(this,selectors, selector, parentElement));
        }
      }.bind(this));

      var deferredResponse = Deferred();
      whenCallSequentially(deferredDataCalls).done(function(responses) {

        var commonData = {};
        responses.forEach(function(data) {
          commonData = _.merge(commonData, data);
        });
        deferredResponse.resolve(commonData);
      });

      return deferredResponse;
    },

    getSelectorCommonData: function(selectors, selector, parentElement) {

      var d = Deferred();
      var deferredData = selector.getData(parentElement);
      deferredData.done(function(data) {

        if (selector.willReturnElements()) {
          var newParentElement = data[0];
          var deferredChildCommonData = this.getSelectorTreeCommonData(selectors, selector.id, newParentElement);
          deferredChildCommonData.done(function(data){
            d.resolve(data);
          });
        }
        else {
          d.resolve(data[0]);
        }
      }.bind(this));

      return d;
    },

    /**
     * Returns all data records for a selector that can return multiple records
     */
    getMultiSelectorData: function(selectors, selector, parentElement, commonData) {

      var deferredResponse = Deferred();

      // if the selector is not an Element selector then its fetched data is the result.
      if (!selector.willReturnElements()) {

        var deferredData = selector.getData(parentElement);
        deferredData.done(function(selectorData) {
          var newCommonData = _.cloneDeep(commonData);
          var resultData = [];

          selectorData.forEach(function (record) {
            _.merge(record, newCommonData, true);
            resultData.push(record);
          }.bind(this));

          deferredResponse.resolve(resultData);
        }.bind(this));

      }

      // handle situation when this selector is an elementSelector
      var deferredData = selector.getData(parentElement);
      deferredData.done(function(selectorData) {
        var deferredDataCalls = [];

        selectorData.forEach(function (element) {

          var newCommonData = _.cloneDeep(commonData);
          var childRecordDeferredCall = this.getSelectorTreeData.bind(this, selectors, selector.id, element, newCommonData);
          deferredDataCalls.push(childRecordDeferredCall);
        }.bind(this));

        whenCallSequentially(deferredDataCalls).done(function(responses) {
          var resultData = [];
          responses.forEach(function(childRecordList) {
            childRecordList.forEach(function(childRecord){
              var rec = new Object();
              _.merge(rec, childRecord, true);
              resultData.push(rec);
            });
          });
          deferredResponse.resolve(resultData);
        }.bind(this));
      }.bind(this));

      return deferredResponse;
    },

    getSelectorTreeData: function (selectors, parentSelectorId, parentElement, commonData) {

      var childSelectors = selectors.getDirectChildSelectors(parentSelectorId);
      var childCommonDataDeferred = this.getSelectorTreeCommonData(selectors, parentSelectorId, parentElement);
      var deferredResponse = Deferred();

      childCommonDataDeferred.done(function(childCommonData) {
        commonData = _.merge(commonData, childCommonData);

        var dataDeferredCalls = [];

        childSelectors.forEach(function (selector) {
          if (selectors.willReturnMultipleRecords(selector.id)) {

            var newCommonData = _.cloneDeep(commonData);
            var dataDeferredCall = this.getMultiSelectorData.bind(this, selectors, selector, parentElement, newCommonData);
            dataDeferredCalls.push(dataDeferredCall);
          }
        }.bind(this));

        // merge all data records together
        whenCallSequentially(dataDeferredCalls).done(function(responses) {
          var resultData = [];
          responses.forEach(function(childRecords) {
            childRecords.forEach(function(childRecord){
              var rec = new Object();
              _.merge(rec, childRecord, true);
              resultData.push(rec);
            });
          });

          if (resultData.length === 0) {
            // If there are no multi record groups then return common data.
            // In a case where common data is empty return nothing.
            if(Object.keys(commonData).length === 0) {
              deferredResponse.resolve([]);
            }
            else {

              deferredResponse.resolve([commonData]);
            }
          }
          else {
            deferredResponse.resolve(resultData);
          }

        }.bind(this));
      }.bind(this));

      return deferredResponse;
    },

    getData: function () {

      var selectorTrees = this.findSelectorTrees();
      var dataDeferredCalls = [];

      selectorTrees.forEach(function (selectorTree) {

        var deferredTreeDataCall = this.getSelectorTreeData.bind(this, selectorTree, this.parentSelectorId, this.parentElement, {});
        dataDeferredCalls.push(deferredTreeDataCall);
      }.bind(this));

      var responseDeferred = Deferred();
      whenCallSequentially(dataDeferredCalls).done(function(responses) {
        var results = [];
        responses.forEach(function(dataResults) {
          results = results.concat(dataResults);
        }.bind(this));
        responseDeferred.resolve(results);
      }.bind(this));
      return responseDeferred;
    },

    getSingleSelectorData: function(parentSelectorIds, selectorId) {

      // to fetch only single selectors data we will create a sitemap that only contains this selector, his
      // parents and all child selectors
      var sitemap = this.sitemap;
      var selector = this.sitemap.selectors.getSelector(selectorId);
      var childSelectors = sitemap.selectors.getAllSelectors(selectorId);
      var parentSelectors = [];
      for(var i = parentSelectorIds.length-1;i>=0;i--) {
        var id = parentSelectorIds[i];
        if(id === '_root') break;
        var parentSelector = this.sitemap.selectors.getSelector(id);
        parentSelectors.push(parentSelector);
      }

      // merge all needed selectors together
      var selectors = parentSelectors.concat(childSelectors);
      selectors.push(selector);
      sitemap.selectors = new SelectorList(selectors);

      var parentSelectorId;
      // find the parent that leaded to the page where required selector is being used
      for(var i = parentSelectorIds.length-1;i>=0;i--) {
        var id = parentSelectorIds[i];
        if(id === '_root') {
          parentSelectorId = id;
          break;
        }
        var parentSelector = this.sitemap.selectors.getSelector(parentSelectorIds[i]);
        if(!parentSelector.willReturnElements()) {
          parentSelectorId = id;
          break;
        }
      }
      this.parentSelectorId = parentSelectorId;

      return this.getData();
    }
  };

  var parentSelectorIds = ['_root'];
  var selectorId = config.sitemap.selectors[0].id;

  var extractor = new DataExtractor({
    sitemap: config.sitemap,
    parentSelectorIds: parentSelectorIds,
  });

  return extractor.getSingleSelectorData(parentSelectorIds, selectorId);
}

module.exports = load;