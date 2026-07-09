import { expect, type Locator, type Page } from "@playwright/test";

// Page Object for an organization's tasks page (route: /orgs/:orgId, the
// "Tasks" tab). Todos are org-scoped (ADR-0020), so the add-todo surface
// lives here rather than at the old `/` index. Only this file knows about
// data-testid="add-todo-input" etc.
export class OrgTasksPage {
  constructor(
    private readonly page: Page,
    private readonly orgId: string,
  ) {}

  public async visit(): Promise<void> {
    await this.page.goto(`/orgs/${this.orgId}`);
    await expect(this.input).toBeVisible();
  }

  // For when the caller already navigated here (e.g. right after creating
  // the org): just assert the form is ready.
  public async expectReady(): Promise<void> {
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
