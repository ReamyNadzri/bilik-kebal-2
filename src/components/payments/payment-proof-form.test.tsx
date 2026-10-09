import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaymentProofForm } from "./payment-proof-form";

function renderForm(offline = false) {
  return render(
    <PaymentProofForm heading="Send your proof" nextVersion={2} offline={offline} mode="preview" />,
  );
}

function choose(file: File) {
  fireEvent.change(screen.getByLabelText(/Choose your payment screenshot/), {
    target: { files: [file] },
  });
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Submit proof for checking" }));

describe("PaymentProofForm", () => {
  it("asks for a screenshot, linking the summary to the file control", () => {
    renderForm();

    submit();

    const link = screen.getByRole("link", { name: "Choose a screenshot of your payment." });
    expect(link).toHaveAttribute("href", "#payment-proof-file");
    expect(screen.getByLabelText(/Choose your payment screenshot/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.queryByText(/nothing was uploaded/)).not.toBeInTheDocument();
  });

  it("refuses a file that is not a PNG or JPEG", () => {
    renderForm();
    choose(new File(["%PDF"], "receipt.pdf", { type: "application/pdf" }));

    submit();

    expect(
      screen.getByRole("link", { name: "Choose a PNG or JPEG screenshot." }),
    ).toBeInTheDocument();
  });

  it("says plainly that the preview uploads nothing, and which version it would be", () => {
    renderForm();
    choose(new File(["png"], "paid.png", { type: "image/png" }));

    submit();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Preview only: nothing was uploaded. On the live screen this saves your screenshot to this request as version 2",
    );
    expect(screen.getByText("paid.png")).toBeInTheDocument();
  });

  it("does not submit while offline", () => {
    renderForm(true);
    choose(new File(["png"], "paid.png", { type: "image/png" }));

    submit();

    expect(screen.queryByText(/nothing was uploaded/)).not.toBeInTheDocument();
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
  });
});
