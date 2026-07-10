import { useEffect, useState } from "react";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { fetchMyTodos, createTodo, toggleTodoDone, deleteTodo } from "../lib/todos";
import { Card, CardHeader, CardBody } from "./ui/Basics";

export default function TodoWidget() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState("");

  const load = () => fetchMyTodos().then(setTodos);

  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await createTodo(text.trim());
    setText("");
    load();
  };

  const toggle = async (todo) => {
    await toggleTodoDone(todo.id, !todo.is_done);
    load();
  };

  const remove = async (id) => {
    await deleteTodo(id);
    load();
  };

  return (
    <Card>
      <CardHeader icon={ListChecks} title="할 일" />

      <form onSubmit={add} className="flex items-center gap-2 px-4 py-3 border-b border-line shrink-0">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="할 일을 입력하고 Enter"
          className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-line text-sm outline-none focus:border-jade-500"
        />
        <button type="submit" className="p-1.5 rounded-md text-subink hover:bg-porcelain hover:text-jade-600 shrink-0">
          <Plus size={15} />
        </button>
      </form>

      <CardBody>
        {todos.length === 0 ? (
          <p className="text-sm text-subink text-center py-6">등록된 할 일이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-line">
            {todos.map((todo) => (
              <li key={todo.id} className="flex items-center gap-2 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={todo.is_done}
                  onChange={() => toggle(todo)}
                  className="w-4 h-4 accent-jade-600 shrink-0"
                />
                <span className={`flex-1 min-w-0 text-sm truncate ${todo.is_done ? "line-through text-subink" : "text-ink"}`}>
                  {todo.content}
                </span>
                <button
                  onClick={() => remove(todo.id)}
                  className="p-1 rounded-md text-subink hover:text-clay-600 shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
