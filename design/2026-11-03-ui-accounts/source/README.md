# Accounts design · source files

Source of the Claude Design canvas "Todo app · Accounts"
(https://claude.ai/artifact/6ZLaC1R7ySWQxcZnhFrqzN), exported here because
the canvas's own HTML export is over 16 MB (it inlines the renderer bundle
and fonts once per artboard) and cannot be downloaded. These files are the
design itself, about 340 KB.

- `canvas.json`: the board layout, one entry per artboard with its title,
  size and position. Read it first; its titles are the index.
- `app.css`: the shared tokens (colors, type, spacing, radii, light and
  dark themes) and the page patterns (`.app`, `.auth`, `.form`, `.field`,
  `.notice`, `.table`, `.menu`, ...). It styles these design files only;
  it is not the BFF's CSS.
- `*.dc.html`: the artboards. Eight carry markup (`Main`, `TopBar`, `SignIn`,
  `SignUp`, `Profile`, `Users`, `UserDetail`, `Error`); the other fifty are
  state wrappers that import one of those with fixed props (`theme`,
  `state`, `account`, `code`, ...). The `<dc-import>` line in a wrapper
  names the component and the props that produce that state.

They are not standalone pages: the `./support.js` they reference is the
canvas renderer and is not included. Read them as markup and CSS; the PNGs
beside this folder are the rendered reference.
