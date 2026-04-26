import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import { todayISO } from "./lib/date";
import { InMemoryPlannerRepository } from "./test/InMemoryPlannerRepository";

describe("App smoke flows", () => {
  it("creates, edits, updates status, and deletes workouts with marker updates", async () => {
    const repository = new InMemoryPlannerRepository();
    const selectedDateISO = todayISO();

    render(<App repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText("Add Workout from Template")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add Workout from Template"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Easy Run" })).toBeInTheDocument();
      expect(screen.getByTestId(`day-count-${selectedDateISO}`)).toHaveTextContent("1");
    });

    fireEvent.click(screen.getByText("Edit"));

    const titleInput = screen.getByLabelText("Title") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Easy Run Updated" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Easy Run Updated" })).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText("Status for Easy Run Updated") as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "completed" } });

    await waitFor(() => {
      expect(statusSelect.value).toBe("completed");
    });

    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { level: 3, name: "Easy Run Updated" })).not.toBeInTheDocument();
      expect(screen.queryByTestId(`day-count-${selectedDateISO}`)).not.toBeInTheDocument();
    });
  });

  it("updates month marker counts after moving a workout to another day", async () => {
    const repository = new InMemoryPlannerRepository();
    const selectedDateISO = todayISO();

    render(<App repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText("Add Workout from Template")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add Workout from Template"));

    await waitFor(() => {
      expect(screen.getByTestId(`day-count-${selectedDateISO}`)).toHaveTextContent("1");
    });

    fireEvent.click(screen.getByText("Edit"));

    const dateInput = screen.getByLabelText("Date") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2030-01-01" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.queryByTestId(`day-count-${selectedDateISO}`)).not.toBeInTheDocument();
    });
  });
});
