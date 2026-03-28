import "@testing-library/jest-dom";
import "vitest-axe/extend-expect";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { expect } from "vitest";

expect.extend(toHaveNoViolations);
