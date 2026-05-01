import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import { todayISO } from "./lib/date";
import { InMemoryPlannerRepository } from "./test/InMemoryPlannerRepository";

describe("App smoke flows", () => {
  it("creates a simple run and updates status", async () => {
    const repository = new InMemoryPlannerRepository();

    render(<App repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText("New Entry")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add VDOT"));

    const titleInput = screen.getByPlaceholderText("Workout title");
    fireEvent.change(titleInput, { target: { value: "Easy Today" } });
    fireEvent.click(screen.getByText("Save Entry"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Easy Today" })).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText("Status for Easy Today") as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "completed" } });

    await waitFor(() => {
      expect(statusSelect.value).toBe("completed");
    });
  });

  it("creates a workout entry with time recovery and renders weekly summary metrics", async () => {
    const repository = new InMemoryPlannerRepository();

    render(<App repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText("New Entry")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add VDOT"));
    await waitFor(() => {
      expect(screen.getByText(/Active VDOT: 45/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Workout title"), { target: { value: "Track Session" } });
    fireEvent.change(screen.getByLabelText("Entry Mode"), { target: { value: "workout" } });

    fireEvent.change(screen.getByLabelText("Recovery Mode"), { target: { value: "time" } });

    fireEvent.click(screen.getByText("Save Entry"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Track Session" })).toBeInTheDocument();
      expect(screen.getAllByText(/Total:/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/T:/).length).toBeGreaterThan(0);
    });

    const todayMarker = screen.queryByTestId(`day-count-${todayISO()}`);
    expect(todayMarker).not.toBeNull();
  });
});
