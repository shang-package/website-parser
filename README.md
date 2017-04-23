# site-scraper

## description

let part of [web-scraper-chrome-extension](https://github.com/martinsbalodis/web-scraper-chrome-extension) functions run on node

## example

```js
var config = {
  sitemap: 'export from web-scraper-chrome-extension',
  html: 'the page html',
};

require('site-scraper')(config)
  .then(function (data) {
    console.log("dataextractor data", data);
  });
```