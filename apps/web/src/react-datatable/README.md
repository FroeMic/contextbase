# react-datatable

Copyable React table source for the `react-datatable` kit.

Import from `index.ts`:

```tsx
import { Datatable, type DatatableColumn } from "./react-datatable";
```

The folder includes the table implementation, hooks, types, feature modules,
and local shadcn-style UI primitives. It has no app-domain imports and is meant
to live directly in the buyer's codebase.

## Required App Setup

- Configure Tailwind v4 to scan `./src/react-datatable`.
- Provide shadcn-compatible CSS variables in global CSS.

Use the installed starter module as the setup reference. If you also installed
examples, they show local and online wiring.

## Public Surface

- `Datatable`: main table component.
- `DatatableColumn`: column type.
- `DatatableProps`: component props.
- Selection, virtualization, keyboard, row action, preview, bulk action, and
  online mode types.
