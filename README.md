# Css Code Action

A vscode extension help editing scss/less file with color replace and px convert.

## 1.0 breaking changed:
* use ejs for `colorReplaceOptions` and `pxReplaceOptions` template render.
* configuration: "cssAction.colorVariablesFile" => "cssAction.variablesFile".

## ejs render context: 
```js
{
  _VAR_NAME_: 'color and size var name defined in variablesFile',
  _MATCHED_TEXT_: 'origin text matched by regex',
  _REM_RESULT_: 'rem result converted from px value based on rootFontSize, only in `colorReplaceOptions`'
}
```

## Color Replace

> color replace help replace hex css string to color variable defined in (scss/less) file.

```json
{
  "cssAction.variablesFile": "src/style/variables.scss",
  "cssAction.colorReplaceOptions": ["<%= _VAR_NAME_ %>"]
}
```

![color replace action](https://tva1.sinaimg.cn/large/0081Kckwly1gld7ygo47aj319h0u07b3.jpg)

## Px convert

> px convert help convert px to sccc/less func or auto calc based on root font size. 

```json
{
  "cssAction.rootFontSize": 16,
  "cssAction.pxReplaceOptions": ["<%= _VAR_NAME_ %>", "<%= _REM_RESULT_ %>", "px2rem(<%= _MATCHED_TEXT_ %>)"]
}
```

![addition action](https://tva1.sinaimg.cn/large/0081Kckwly1gldfsn0l21j317w0u0wjn.jpg)
