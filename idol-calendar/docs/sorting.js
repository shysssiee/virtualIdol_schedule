// One shared reorder control for drag, keyboard and touch buttons.
export function bindSorting(container, onChange) {
  let dragged;
  let pending = false;
  const rows = () => [...container.querySelectorAll(":scope > [data-sort-id]")];
  async function move(row, target, after = false) {
    if (pending || !row || !target || row === target) return;
    pending = true;
    const original = rows();
    target[after ? "after" : "before"](row);
    try {
      await onChange(rows().map((node) => node.dataset.sortId));
    } catch (error) {
      container.replaceChildren(...original);
      throw error;
    } finally {
      pending = false;
    }
  }
  for (const row of rows()) {
    const handle = row.querySelector("[data-drag]");
    handle.draggable = true;
    handle.ondragstart = (event) => {
      dragged = row;
      event.dataTransfer.setData("text/plain", row.dataset.sortId);
    };
    handle.ondragend = () => {
      dragged = null;
    };
    row.ondragover = (event) => event.preventDefault();
    row.ondrop = async (event) => {
      event.preventDefault();
      await move(
        dragged,
        row,
        event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2,
      ).catch((error) =>
        container.dispatchEvent(
          new CustomEvent("sorterror", { detail: error }),
        ),
      );
    };
    for (const direction of [-1, 1]) {
      row.querySelector(`[data-move="${direction}"]`).onclick = async () => {
        const list = rows(),
          target = list[list.indexOf(row) + direction];
        await move(row, target, direction > 0).catch((error) =>
          container.dispatchEvent(
            new CustomEvent("sorterror", { detail: error }),
          ),
        );
      };
    }
  }
}
