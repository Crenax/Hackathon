import type { ChangeEventHandler, InputHTMLAttributes } from "react";

interface AutocompleteInputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "placeholder" | "value"> {
    expValue: string;
    expOnChange: ChangeEventHandler<HTMLInputElement>;
    expPlaceholder?: string;
}

export default function AutocompleteInputField(props: AutocompleteInputFieldProps): React.JSX.Element;
