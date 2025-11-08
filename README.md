# Markdown Automaton 

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/forliage.markdown-automaton?style=for-the-badge&label=Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=forliage.markdown-automaton)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/forliage.markdown-automaton?style=for-the-badge&color=green)](https://marketplace.visualstudio.com/items?itemName=forliage.markdown-automaton)

Bring your finite automata diagrams to life directly within your Markdown files! This extension allows you to describe state machines using a simple, intuitive syntax and renders them as beautiful, standard-compliant diagrams in your VS Code Markdown preview.

Most importantly, it provides a crucial **"Bake"** feature that converts your diagrams into embedded SVG images, ensuring they appear perfectly when you export your Markdown to PDF, HTML, or view it on platforms like GitHub or Typora.


## Features

- **Simple & Clean Syntax**: Describe states and transitions in a human-readable format.
- **Live Preview**: See a placeholder for your automaton in the live Markdown preview.
- **Export-Ready**: A one-click "Bake" command transforms diagrams into universally compatible embedded SVG images.
- **Standard-Compliant Diagrams**: Renders standard initial, final, and combined (initial+final) states correctly.
- **Powered by Graphviz**: Utilizes the robust and industry-standard Graphviz engine for high-quality rendering.
- **Lightweight & Fast**: No heavy dependencies, ensuring a smooth experience.


## 🔧 How to Use

### 1. Describing Your Automaton

In any Markdown file, create a code block and specify the language as `automaton`.

```automaton
```

### 2. Syntax Guide

The syntax is line-based and straightforward:

**Define a State:**
Simply write the name of the state. You can add attributes in brackets.

```automaton
q0 [initial] [final]  // q0 is both an initial and a final state
q1 [final]            // q1 is a final state
q2 [initial]          // q2 is an initial state
q3                    // q3 is a normal state
```

**Define a Transition:**
Use the `->` arrow to define a transition between states, followed by a colon `:` and the label.

```automaton
q0 -> q1 : a
q1 -> q2 : b
q2 -> q2 : c, d  // Labels can contain commas or other symbols
```


### 3. Baking for Export (Crucial Step!)

The live preview shows a placeholder to keep things fast. To render the final diagrams for export:

1.  Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
2.  Type and select **"Automaton: Bake diagrams for export"**.
3.  The extension will replace all `automaton` code blocks in your active file with embedded `<img src="...">` tags containing the rendered SVG.

Your Markdown file is now ready to be converted to PDF/HTML or pushed to GitHub with perfectly displayed diagrams!

---

## 🛠️ Installation

1.  Open **Visual Studio Code**.
2.  Go to the **Extensions** view (`Ctrl+Shift+X`).
3.  Search for `Markdown Automaton`.
4.  Click **Install**.


## License

This extension is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing & Acknowledgements

Feel free to open an issue or submit a pull request on [GitHub](https://github.com/forliage/markdown-automaton)!

This extension heavily relies on the amazing [Viz.js](https://github.com/mdaines/viz.js) library, a JavaScript port of Graphviz.


**Enjoy creating beautiful automata diagrams!**