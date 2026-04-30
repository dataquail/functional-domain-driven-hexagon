import { expect, type Locator, type Page } from "@playwright/test";

// Page Object for the todos page (route: /). Hides selectors and Playwright
// API behind domain-shaped methods so specs can stay declarative. Only this
// file knows about data-testid="add-todo-input" etc.
export class IndexPage {
  constructor(private readonly page: Page) {}

  public async visit(): Promise<void> {
    await this.page.goto("/");
    // Wait on the form's testid rather than a heading — Card.Title renders a
    // <div>, not a heading element.
    await expect(this.input).toBeVisible();
  }

  private get input(): Locator {
    return this.page.getByTestId("add-todo-input");
  }

  private get submit(): Locator {
    return this.page.getByTestId("add-todo-submit");
  }

  private get list(): Locator {
    return this.page.getByTestId("todo-list");
  }

  public async addTodo(title: string): Promise<void> {
    await this.input.fill(title);
    await this.submit.click();
  }

  public async expectTodoVisible(title: string): Promise<void> {
    await expect(
      this.list.locator(`[data-testid="todo-item"][data-todo-title="${title}"]`),
    ).toBeVisible();
  }

  public async expectInputCleared(): Promise<void> {
    await expect(this.input).toHaveValue("");
  }
}
