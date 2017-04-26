# website-parser

## description

let [web-scraper-chrome-extension](https://github.com/martinsbalodis/web-scraper-chrome-extension) parser functions run on node

## example

```js
let config = {
  sitemap: 'export from web-scraper-chrome-extension',
  html: 'the page html',
};

require('website-parser')(config)
  .then(function (data) {
    console.log('data:', data);
  });
```