# PlantUML Diagrams for LaTeXML ArXiv Processing System

This folder contains PlantUML diagrams that visualize the architecture and processes of the LaTeXML ArXiv processing system.

## Diagrams Overview

1. **overall-architecture.uml** - Complete system overview showing all components and data flow
2. **progress-worker.uml** - Event-driven progress tracking system architecture
3. **arxiv-download.uml** - ArXiv download and extraction process
4. **latex-compilation.uml** - LaTeX to HTML compilation workflow
5. **postprocessing.uml** - HTML post-processing pipeline
6. **embedding-generation.uml** - Semantic embedding creation process
7. **google-drive-upload.uml** - Google Drive integration workflow
8. **sse-streaming.uml** - Server-Sent Events communication flow

## Viewing the Diagrams

### Online Viewers
You can view these diagrams using online PlantUML viewers:
- **PlantUML Online Server**: http://www.plantuml.com/plantuml/uml/
- **PlantText**: https://www.planttext.com/
- **VS Code PlantUML Extension**: Install the PlantUML extension in VS Code

### Local Generation
To generate PNG/SVG images locally:

```bash
# Install PlantUML (requires Java)
# Ubuntu/Debian:
sudo apt-get install plantuml

# macOS:
brew install plantuml

# Generate all diagrams as PNG
for file in *.uml; do
    plantuml -tpng "$file"
done

# Generate all diagrams as SVG
for file in *.uml; do
    plantuml -tsvg "$file"
done
```

## Usage in Documentation

### Markdown
```markdown
![Overall Architecture](overall-architecture.png)
```

### HTML
```html
<img src="overall-architecture.png" alt="Overall Architecture" width="100%">
```

### LaTeX
```latex
\includegraphics[width=\textwidth]{overall-architecture.png}
```

## PlantUML Features Used

- **Component Diagrams**: For system architecture
- **Activity Diagrams**: For process flows
- **Class Diagrams**: For data structures
- **Sequence Diagrams**: For communication flows
- **Notes and Annotations**: For detailed explanations
- **Partitions and Groups**: For logical organization
- **Themes**: Blueprint theme for professional appearance

## Benefits of PlantUML

1. **Text-Based**: Easy to version control and collaborate
2. **Cross-Platform**: Works anywhere with Java
3. **Multiple Output Formats**: PNG, SVG, PDF, ASCII art
4. **IDE Integration**: Excellent VS Code support
5. **No Dependencies**: Unlike TikZ, doesn't require LaTeX
6. **Fast Rendering**: Quick compilation and preview
7. **Consistent Styling**: Professional themes available

## VS Code Integration

1. Install the "PlantUML" extension
2. Open any `.uml` file
3. Press `Alt+D` to preview
4. Use `Ctrl+Shift+P` → "PlantUML: Export Current Diagram"

The diagrams will automatically update as you edit the source files!