# Css Code Action

A vscode extension help editing scss/less file with color replace and px convert.

## Color Replace

> color replace help replace hex css string to color variable defined in (scss/less) file.

```json
{
  "cssAction.colorVariablesFile": "src/style/variables.scss"
}
```

![color replace action](https://tva1.sinaimg.cn/large/0081Kckwly1gld7ygo47aj319h0u07b3.jpg)

## Px convert

> px convert help convert px to sccc/less func or auto calc based on root font size. 

```json
{
  "cssAction.rootFontSize": 16,
  "cssAction.pxReplaceOptions": ["px2rem($&)", "px2rem2($&)", "_AUTO_CALC_"]
}
```

![addition action](https://tva1.sinaimg.cn/large/0081Kckwly1gldfsn0l21j317w0u0wjn.jpg)
