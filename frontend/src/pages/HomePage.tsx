import type { User } from "../api";
import Todos from "../components/Todos";

export default function HomePage({ me }: { me?: User }) {
  return <Todos me={me} />;
}
