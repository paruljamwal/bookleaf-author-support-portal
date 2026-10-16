import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../components/ui";

describe("status badge", () => {
  it("includes a text label", () => {
    render(<StatusBadge status="OPEN" />);
    expect(screen.getByText("Open")).toBeTruthy();
  });
});
