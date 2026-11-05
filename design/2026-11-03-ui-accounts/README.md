# Accounts design, 2026-11-03

The export of the owner's Claude Design session for user accounts: one
PNG per screen, named `<device>-<theme>-<screen>-<state>.png`.

The canvas's HTML export was too large to download: it inlines the
renderer and the fonts once per artboard, over 16 MB. The canvas is the
Claude Design artifact at
<https://claude.ai/artifact/6ZLaC1R7ySWQxcZnhFrqzN#page-dcb81aee8d83>.
Its sources, about 340 KB, are in [source/](source/README.md): the board
index, the shared CSS and the artboards' markup. They read as source,
not as pages, because the renderer they load is not included. The PNGs
are the rendered reference.

Desktop light holds every screen and state. Desktop dark, mobile light
and mobile dark each sample a few screens.
