# ScribbleSVG

A lightweight, SVG-based toolkit for creating basic diagrams and sketches with a hand-drawn scribble style.

## Packages

- `@scribblesvg/core` : diagram types, geometry, validation, and rendering primitives
- `@scribblesvg/react-utils` : React components for display and editing

## Canvas & renderer

`DiagramCanvas` is the interactive editor: pan, zoom, draw shapes, connect arrows, and edit text.

`DiagramRenderer` is a read-only view that turns the same document into SVG - useful anywhere you need to display a diagram without the editor chrome.

Both work from a serializable `DiagramDocument`. Save it as JSON, load it later, and the diagram renders the same way every time. Each shape carries a seed so its hand-drawn strokes stay consistent across sessions and surfaces.

## License

MIT