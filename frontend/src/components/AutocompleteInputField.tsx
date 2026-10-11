import {
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type InputHTMLAttributes,
    type KeyboardEvent,
} from "react";

import "./AutocompleteInputField.css";

interface AutocompleteInputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
    value: string;
    onValueChange: (value: string) => void;
    suggestions?: readonly string[];
    suggestionType?: string;
}

let courseSuggestionsRequest: Promise<string[]> | null = null;

function readCourseName(course: unknown): string | null {
    if (typeof course === "string") {
        return course;
    }

    if (course && typeof course === "object") {
        const record = course as Record<string, unknown>;
        const name = record.title ?? record.name ?? record.value;
        return typeof name === "string" ? name : null;
    }

    return null;
}


function loadCourseSuggestions(): Promise<string[]> {
    if (!courseSuggestionsRequest) {
        courseSuggestionsRequest = fetch("/api/courses")
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Could not load courses (HTTP ${response.status})`);
                }
                return response.json() as Promise<unknown>;
            })
            .then((data) => {
                if (!Array.isArray(data)) {
                    throw new Error("The courses endpoint did not return a list");
                }

                return [...new Set(data.map(readCourseName).filter((course): course is string => Boolean(course)))];
            })
            .catch((error: unknown) => {
                courseSuggestionsRequest = null;
                throw error;
            });
    }

    return courseSuggestionsRequest;
}

export default function AutocompleteInputField({
    value,
    onValueChange,
    suggestions: providedSuggestions,
    suggestionType = "course",
    placeholder,
    onFocus,
    onKeyDown,
    ...inputProps
}: AutocompleteInputFieldProps) {
    const [loadedSuggestions, setLoadedSuggestions] = useState<string[]>([]);
    const [isCourseLoading, setIsCourseLoading] = useState(true);
    const [hasCourseError, setHasCourseError] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const listboxId = useId();
    const suggestions = providedSuggestions ?? loadedSuggestions;
    const isLoading = providedSuggestions === undefined && isCourseLoading;
    const hasError = providedSuggestions === undefined && hasCourseError;
    const suggestionLabel = `${suggestionType[0].toLocaleUpperCase()}${suggestionType.slice(1)} suggestions`;

    const filteredSuggestions = useMemo(() => {
        const query = value.trim().toLocaleLowerCase();
        if (!query) {
            return [];
        }

        return suggestions
            .filter((course) => course.toLocaleLowerCase().includes(query))
            .sort((first, second) => {
                const firstStartsWithQuery = first.toLocaleLowerCase().startsWith(query);
                const secondStartsWithQuery = second.toLocaleLowerCase().startsWith(query);
                if (firstStartsWithQuery !== secondStartsWithQuery) {
                    return firstStartsWithQuery ? -1 : 1;
                }
                return first.localeCompare(second);
            })
            .slice(0, 8);
    }, [suggestions, value]);

    useEffect(() => {
        if (providedSuggestions !== undefined) {
            return;
        }

        let isActive = true;

        loadCourseSuggestions()
            .then((courses) => {
                if (isActive) {
                    setLoadedSuggestions(courses);
                    setHasCourseError(false);
                }
            })
            .catch(() => {
                if (isActive) {
                    setHasCourseError(true);
                }
            })
            .finally(() => {
                if (isActive) {
                    setIsCourseLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [providedSuggestions]);

    useEffect(() => {
        function closeOnOutsideClick(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setHighlightedIndex(-1);
            }
        }

        document.addEventListener("mousedown", closeOnOutsideClick);
        return () => document.removeEventListener("mousedown", closeOnOutsideClick);
    }, []);

    function selectSuggestion(course: string) {
        onValueChange(course);
        setIsOpen(false);
        setHighlightedIndex(-1);
    }

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        onValueChange(event.target.value);
        setIsOpen(true);
        setHighlightedIndex(0);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (isOpen && filteredSuggestions.length > 0) {
            if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlightedIndex((current) => (current + 1) % filteredSuggestions.length);
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlightedIndex((current) => (current - 1 + filteredSuggestions.length) % filteredSuggestions.length);
            } else if (event.key === "Enter" && highlightedIndex >= 0) {
                event.preventDefault();
                selectSuggestion(filteredSuggestions[highlightedIndex]);
            } else if (event.key === "Escape") {
                event.preventDefault();
                setIsOpen(false);
                setHighlightedIndex(-1);
            }
        }

        if (!event.defaultPrevented) {
            onKeyDown?.(event);
        }
    }

    const showMenu = isOpen && value.trim().length > 0;

    return (
        <div className="course-autocomplete" ref={containerRef}>
            <input
                {...inputProps}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showMenu}
                aria-controls={showMenu && filteredSuggestions.length > 0 ? listboxId : undefined}
                aria-activedescendant={
                    showMenu && highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length
                        ? `${listboxId}-option-${highlightedIndex}`
                        : undefined
                }
                autoComplete="off"
                value={value}
                onChange={handleChange}
                onFocus={(event) => {
                    setIsOpen(true);
                    setHighlightedIndex(0);
                    onFocus?.(event);
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
            />

            {showMenu && (
                <div className="course-autocomplete-menu">
                    {isLoading ? (
                        <p className="course-autocomplete-status">Loading {suggestionType}s…</p>
                    ) : hasError ? (
                        <p className="course-autocomplete-status course-autocomplete-error">Could not load {suggestionType} suggestions.</p>
                    ) : filteredSuggestions.length === 0 ? (
                        <p className="course-autocomplete-status">No matching {suggestionType}s.</p>
                    ) : (
                        <ul id={listboxId} role="listbox" aria-label={suggestionLabel}>
                            {filteredSuggestions.map((course, index) => (
                                <li
                                    id={`${listboxId}-option-${index}`}
                                    key={course}
                                    role="option"
                                    aria-selected={index === highlightedIndex}
                                    className={index === highlightedIndex ? "is-highlighted" : undefined}
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        selectSuggestion(course);
                                    }}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                >
                                    {course}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
