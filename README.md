# Css Code Action

A vscode extension help replace hex css string to color variable defined in (scss/less) file.

## Color Replace
```json
{
  "cssAction.colorVariablesFile": "src/style/variables.scss"
}
```

![color replace action](https://tva1.sinaimg.cn/large/0081Kckwly1gld7ygo47aj319h0u07b3.jpg)

## Addition Action

> Addition action give you a way to search a regex in current line and replace it something you want via quik fix. 

```json
{
  "cssAction.additionActionSearchRegex": "(\\d+px\\s*)+(?![^(]*\\))",
  "cssAction.additionActionReplaceTargets": ["px2rem($&)", "px2rem2($&)"]
}
```

![addition action](https://tva1.sinaimg.cn/large/0081Kckwly1gld7vszse6j319z0u00x4.jpg)