import React, { Component } from "react"
import {
  Editor,
  EditorState,
  RichUtils,
  CompositeDecorator,
  AtomicBlockUtils,
  ContentBlock,
  getDefaultKeyBinding,
  DraftBlockType,
  DraftEntityType,
  RawDraftContentState,
} from "draft-js"

import {
  getListNestingStyles,
  blockDepthStyleFn,
  onDraftEditorCopy,
  onDraftEditorCut,
  handleDraftEditorPastedText,
  createEditorStateFromRaw,
  serialiseEditorStateToRaw,
} from "../../lib/index"

import SentryBoundary from "./SentryBoundary"
import Highlight from "./Highlight"
import Link, { linkStrategy } from "./Link"
import Image from "./Image"
import Snippet from "./Snippet"

import DraftUtils from "../utils/DraftUtils"

import "./DemoEditor.css"

const BLOCKS = {
  unstyled: "P",
  "unordered-list-item": "UL",
  "ordered-list-item": "OL",
  "header-one": "H1",
  "header-two": "H2",
  "header-three": "H3",
  "code-block": "{ }",
}

const BLOCKS_EXTENDED = {
  unstyled: "P",
  "unordered-list-item": "UL",
  "ordered-list-item": "OL",
  "header-one": "H1",
  "header-two": "H2",
  "header-three": "H3",
  "header-four": "H4",
  "header-five": "H5",
  "header-six": "H6",
  blockquote: "❝",
  "code-block": "{ }",
}

const STYLES = {
  BOLD: "B",
  ITALIC: "I",
}

const STYLES_EXTENDED = {
  BOLD: "B",
  ITALIC: "I",
  CODE: "`",
  STRIKETHROUGH: "~",
  UNDERLINE: "_",
}

const ENTITIES = [
  {
    type: "LINK",
    label: "🔗",
    attributes: ["url"],
    whitelist: {
      href: "^(http:|https:|undefined$)",
    },
  },
  {
    type: "IMAGE",
    label: "📷",
    attributes: ["src"],
    whitelist: {
      src: "^http",
    },
  },
  {
    type: "SNIPPET",
    label: "🌱",
    attributes: ["text"],
    whitelist: {},
  },
  {
    type: "HORIZONTAL_RULE",
    label: "HR",
    attributes: [],
    whitelist: {},
  },
]

const MAX_LIST_NESTING = 15

const listNestingStyles = (
  <style>{getListNestingStyles(MAX_LIST_NESTING)}</style>
)

export interface DemoEditorProps {
  rawContentState: RawDraftContentState
  extended?: boolean
}

export interface DemoEditorState {
  editorState: EditorState
  readOnly: boolean
}

/**
 * Demo editor.
 */
class DemoEditor extends Component<DemoEditorProps, DemoEditorState> {
  static defaultProps = {
    rawContentState: null,
  }

  constructor(props: DemoEditorProps) {
    super(props)
    const { rawContentState } = props
    const decorator = new CompositeDecorator([
      {
        strategy: linkStrategy,
        component: Link,
      },
    ])
    this.state = {
      editorState: createEditorStateFromRaw(rawContentState, decorator),
      readOnly: false,
    }
    this.onChange = this.onChange.bind(this)
    this.keyBindingFn = this.keyBindingFn.bind(this)
    this.addBR = this.addBR.bind(this)
    this.toggleReadOnly = this.toggleReadOnly.bind(this)
    this.toggleStyle = this.toggleStyle.bind(this)
    this.toggleBlock = this.toggleBlock.bind(this)
    this.toggleEntity = this.toggleEntity.bind(this)
    this.blockRenderer = this.blockRenderer.bind(this)
    this.handlePastedText = this.handlePastedText.bind(this)
  }

  onChange(nextState: EditorState) {
    this.setState({
      editorState: nextState,
    })
  }

  toggleStyle(type: string, e: React.MouseEvent) {
    const { editorState } = this.state
    this.onChange(RichUtils.toggleInlineStyle(editorState, type))
    e.preventDefault()
  }

  toggleBlock(type: DraftBlockType, e: React.MouseEvent) {
    const { editorState } = this.state
    this.onChange(RichUtils.toggleBlockType(editorState, type))
    e.preventDefault()
  }

  toggleEntity(type: DraftEntityType | "HORIZONTAL_RULE" | "SNIPPET") {
    const { editorState } = this.state
    let content = editorState.getCurrentContent()

    if (type === "IMAGE") {
      content = content.createEntity(type, "IMMUTABLE", {
        src: "https://thibaudcolas.github.io/draftjs-conductor/wysiwyg-magic-wand.png",
      })
      const entityKey = content.getLastCreatedEntityKey()
      this.onChange(
        AtomicBlockUtils.insertAtomicBlock(editorState, entityKey, " "),
      )
    } else if (type === "SNIPPET") {
      content = content.createEntity(type, "IMMUTABLE", {
        text: "Content of the snippet goes here",
      })
      const entityKey = content.getLastCreatedEntityKey()
      this.onChange(
        AtomicBlockUtils.insertAtomicBlock(editorState, entityKey, " "),
      )
    } else if (type === "HORIZONTAL_RULE") {
      content = content.createEntity(type, "IMMUTABLE", {})
      const entityKey = content.getLastCreatedEntityKey()
      this.onChange(
        AtomicBlockUtils.insertAtomicBlock(editorState, entityKey, " "),
      )
    } else {
      content = content.createEntity(type, "MUTABLE", {
        url: "http://www.example.com/",
      })
      const entityKey = content.getLastCreatedEntityKey()
      const selection = editorState.getSelection()
      this.onChange(RichUtils.toggleLink(editorState, selection, entityKey))
    }
  }

  blockRenderer(block: ContentBlock) {
    const { editorState } = this.state
    const content = editorState.getCurrentContent()

    if (block.getType() !== "atomic") {
      return null
    }

    const entityKey = block.getEntityAt(0)

    if (!entityKey) {
      return {
        editable: false,
      }
    }

    const entity = content.getEntity(entityKey)

    if (entity.getType() === "HORIZONTAL_RULE") {
      return {
        component: () => <hr />,
        editable: false,
      }
    }

    if (entity.getType() === "SNIPPET") {
      return {
        component: Snippet,
        editable: false,
      }
    }

    return {
      component: Image,
      editable: false,
    }
  }

  handlePastedText(
    _: string,
    html: string | undefined,
    editorState: EditorState,
  ) {
    let newState = handleDraftEditorPastedText(html, editorState)

    if (newState) {
      this.onChange(newState)
      return "handled"
    }

    return "not-handled"
  }

  keyBindingFn(event: React.KeyboardEvent) {
    const TAB = 9

    switch (event.keyCode) {
      case TAB: {
        const { editorState } = this.state
        const newState = RichUtils.onTab(event, editorState, MAX_LIST_NESTING)
        this.onChange(newState)
        return null
      }

      default: {
        return getDefaultKeyBinding(event)
      }
    }
  }

  addBR(e: React.MouseEvent) {
    const { editorState } = this.state
    this.onChange(DraftUtils.addLineBreak(editorState))
    e.preventDefault()
  }

  toggleReadOnly(e: React.MouseEvent) {
    this.setState(({ readOnly }: DemoEditorState) => ({
      readOnly: !readOnly,
    }))
    e.preventDefault()
  }

  render() {
    const { extended } = this.props
    const { editorState, readOnly } = this.state
    const styles = extended ? STYLES_EXTENDED : STYLES
    const blocks = extended ? BLOCKS_EXTENDED : BLOCKS
    return (
      <div className="DemoEditor">
        <SentryBoundary>
          <div className="EditorToolbar">
            {Object.entries(styles).map(([type, style]) => (
              <button
                key={type}
                onMouseDown={this.toggleStyle.bind(this, type)}
              >
                {style}
              </button>
            ))}
            {Object.entries(blocks).map(([type, block]) => (
              <button
                key={type}
                onMouseDown={this.toggleBlock.bind(this, type)}
              >
                {block}
              </button>
            ))}
            {ENTITIES.map((type) => (
              <button
                key={type.type}
                onMouseDown={this.toggleEntity.bind(this, type.type)}
              >
                {type.label}
              </button>
            ))}
            <button onMouseDown={this.addBR}>BR</button>
            <button onMouseDown={this.toggleReadOnly}>
              {readOnly ? "📕" : "📖"}
            </button>
          </div>
          <Editor
            editorState={editorState}
            readOnly={readOnly}
            onChange={this.onChange}
            stripPastedStyles={false}
            blockRendererFn={this.blockRenderer}
            blockStyleFn={blockDepthStyleFn}
            keyBindingFn={this.keyBindingFn}
            // @ts-expect-error
            onCopy={onDraftEditorCopy}
            onCut={onDraftEditorCut}
            handlePastedText={this.handlePastedText}
          />
        </SentryBoundary>
        {listNestingStyles}
        <details>
          <summary>
            <span className="link">Debug</span>
          </summary>
          <Highlight
            value={JSON.stringify(
              serialiseEditorStateToRaw(editorState),
              null,
              2,
            )}
          />
        </details>
      </div>
    )
  }
}

export default DemoEditor
