import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { EMAIL_DELIVERY_HINT, EmailDeliveryHint } from "./email-delivery-hint";

test("tells the user to check spam and mark it not spam", () => {
  render(<EmailDeliveryHint />);
  expect(EMAIL_DELIVERY_HINT).toBe(
    "Check your inbox and your Spam or Junk folder. If our email is there, mark it Not spam so future updates reach your inbox.",
  );
  expect(screen.getByRole("note")).toHaveTextContent(EMAIL_DELIVERY_HINT);
});
