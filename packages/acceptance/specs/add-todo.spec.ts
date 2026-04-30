import { IndexPage } from "@/drivers/pages/index-page";
import { truncate } from "@/test-utils/database";
import { test } from "@playwright/test";

const DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ??
  "postgresql://postgres:postgres@localhost:5432/effect-monorepo-test";

test.beforeEach(async () => {
  await truncate(DATABASE_URL_TEST, ["todos"]);
});

test("a todo can be added from the index page", async ({ page }) => {
  const index = new IndexPage(page);
  await index.visit();

  await index.addTodo("Buy milk");

  await index.expectTodoVisible("Buy milk");
  await index.expectInputCleared();
});
