// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { terms } from '@/lib/config/terminology';
import { fmt } from '../charts/format';
import { Button, DataTable, Drawer, RagPair, RagPill, ReadinessPill, Tabs, TabPanel, Tree, TreeRow } from './index';
import { Gallery } from './Gallery';
import { useState } from 'react';

afterEach(cleanup);

describe('status components', () => {
  it('shows text and a shape for every RAG value', () => {
    for (const s of ['red', 'amber', 'green', 'unknown'] as const) {
      const { container, unmount } = render(<RagPill status={s} />);
      expect(container.textContent).toBe(terms.rag[s]);
      expect(container.querySelector('svg')).not.toBeNull();
      unmount();
    }
  });
  it('flags disagreement', () => {
    const { container } = render(<RagPair reported="green" evidence="red" />);
    expect(container.querySelector('[data-disagrees]')).not.toBeNull();
    const ok = render(<RagPair reported="green" evidence="unknown" />);
    expect(ok.container.querySelector('[data-disagrees]')).toBeNull();
  });
  it('uses terminology for readiness', () => {
    render(<ReadinessPill state="not-ready" />);
    expect(screen.getByText(terms.readiness['not-ready'])).toBeTruthy();
  });
});

describe('interaction', () => {
  it('blocks a disabled-with-reason button but keeps it focusable', () => {
    const onClick = vi.fn();
    render(<Button disabledReason="Because" onClick={onClick}>Go</Button>);
    const b = screen.getByRole('button', { name: 'Go' });
    fireEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
    expect(b.getAttribute('aria-disabled')).toBe('true');
    expect((b as HTMLButtonElement).disabled).toBe(false);
  });

  it('sorts a DataTable and fires row click', () => {
    const onRow = vi.fn();
    render(
      <DataTable
        ariaLabel="t"
        rows={[{ id: 'a', n: 2 }, { id: 'b', n: 1 }]}
        getRowId={(r) => r.id}
        onRowClick={onRow}
        columns={[{ id: 'n', header: 'N', accessor: (r) => r.n }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /sort by n/i }));
    const cells = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(cells).toEqual(['1', '2']);
    fireEvent.click(screen.getAllByRole('row')[1]!);
    expect(onRow).toHaveBeenCalledWith({ id: 'b', n: 1 });
  });

  it('moves tab selection with arrow keys', () => {
    function T() {
      const [v, setV] = useState('a');
      return (
        <Tabs ariaLabel="x" value={v} onChange={setV} items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]}>
          <TabPanel id="a">panel a</TabPanel>
          <TabPanel id="b">panel b</TabPanel>
        </Tabs>
      );
    }
    render(<T />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'A' }), { key: 'ArrowRight' });
    expect(screen.getByText('panel b')).toBeTruthy();
  });

  it('closes a drawer on Escape', async () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose} title="T">body</Drawer>);
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates a tree with arrow keys', () => {
    render(
      <Tree ariaLabel="t">
        <TreeRow level={1} label="one" />
        <TreeRow level={1} label="two" />
      </Tree>,
    );
    const items = screen.getAllByRole('treeitem');
    items[0]!.focus();
    fireEvent.keyDown(items[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
  });
});

describe('format', () => {
  it('formats numbers', () => {
    expect(fmt.number(1234)).toBe('1,234');
    expect(fmt.delta(-3)).toBe('−3');
    expect(fmt.delta(4.5, { percent: true, decimals: 1 })).toBe('+4.5%');
    expect(fmt.percent(82.4)).toBe('82%');
  });
});

describe('gallery', () => {
  it('renders every component without throwing', () => {
    const { container } = render(<Gallery />);
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(20);
  });
});
