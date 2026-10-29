---
layout: page
title: Jraw
description: JavaFX drawing application with shape editing, save/load, and undo/redo using MVC and design patterns.
img: assets/img/jraw.jpg
importance: 3
category: creations
related_publications: false
---

## Overview

Jraw is a JavaFX drawing application developed in November 2025 for CSC207: Software Design at the University of Toronto. It supports shape and freehand drawing, selection, resizing, color controls, save/load, and undo/redo.

I used MVC architecture with Command, Observer, and Strategy patterns to separate the interface from the model and support undo/redo. Our team collaborated through Git branches, pull requests, and daily Scrum standups.

## Features

### Drawing Tools

- **Circle** – Click and drag to create circles with adjustable radius
- **Rectangle** – Click and drag to create rectangles with custom dimensions
- **Squiggle** – Freehand drawing tool for creative sketches
- **Polyline** – Multi-point line tool (click to add points, right-click to finish)

### Editing

- Select and resize shapes
- Undo and redo changes

### Visual Options

- Random color generation for each new shape
- Toggle between filled and outline shapes
- Real-time preview while drawing
- 500x500 pixel canvas with white background

### File Operations

- **Save** – Save drawings to custom file format
- **Open** – Load previously saved drawings
- **New** – Create a fresh canvas
- Custom text-based file format with versioning support

## Technical Implementation

### Architecture

The application follows the Model-View-Controller pattern for clear separation of concerns.

### Design Patterns Implemented

| Pattern      | Usage                                                      |
| ------------ | ---------------------------------------------------------- |
| **Visitor**  | `DrawVisitor` for rendering, `SaveVisitor` for persistence |
| **Strategy** | Different drawing strategies for each shape type           |
| **Factory**  | `ShapeManipulatorFactory` creates appropriate strategies   |
| **Command**  | Each shape encapsulated as a `PaintCommand` object         |
| **Observer** | Model-View communication using Observable/Observer         |

### Tech Stack

| Component         | Technology                  |
| ----------------- | --------------------------- |
| **Language**      | Java 22                     |
| **UI Framework**  | JavaFX 22.0.1               |
| **Build Tool**    | Maven 4.0                   |
| **Testing**       | JUnit 5.10.2                |
| **Module System** | Java Platform Module System |

## What I Learned

The project gave me practice with:

- **Object-oriented design principles** – Encapsulation, inheritance, and polymorphism
- **Design pattern application** – Visitor, Strategy, Factory, Command, and Observer patterns
- **MVC architecture** – Clear separation of concerns for maintainability
- **JavaFX GUI development** – Modern desktop application development
- **Java module system** – Better encapsulation and explicit dependency management
- **Unit testing with JUnit** – testing drawing and model behavior
- **File I/O and custom file format design** – Parsing and persistence with versioning support
- **State machine implementation** – Robust parsing with error handling

---

**Note:** Due to university academic integrity policies, the source code for this project is not publicly available. However, I'm happy to share the codebase for review or discussion upon request. Please feel free to reach out if you'd like to learn more about the implementation details.
