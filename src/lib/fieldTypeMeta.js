import {
  AlignLeft,
  AlignJustify,
  Calendar,
  CheckSquare,
  CircleDot,
  Clock,
  Compass,
  Hash,
  Link,
  List,
  ListChecks,
  Mail,
  MessageSquare,
  Phone,
  Tag,
  Type,
  User,
} from 'lucide-react';

/**
 * @typedef {{ value: string, label: string, Icon: import('react').ForwardRefExoticComponent<import('lucide-react').LucideProps> }} FieldTypeDef
 */

/** @type {FieldTypeDef[]} */
export const ADDABLE_FIELD_TYPES = [
  { value: 'text', label: 'Текст', Icon: AlignLeft },
  { value: 'textarea', label: 'Текст (длинный)', Icon: AlignJustify },
  { value: 'number', label: 'Число', Icon: Hash },
  { value: 'date', label: 'Дата', Icon: Calendar },
  { value: 'time', label: 'Время', Icon: Clock },
  { value: 'email', label: 'Email', Icon: Mail },
  { value: 'phone', label: 'Телефон', Icon: Phone },
  { value: 'client', label: 'Клиент', Icon: User },
  { value: 'url', label: 'Ссылка', Icon: Link },
  { value: 'checkbox', label: 'Флажок', Icon: CheckSquare },
  { value: 'select', label: 'Выбор', Icon: List },
  { value: 'multiselect', label: 'Мультивыбор', Icon: ListChecks },
];

/** Built-in types shown in settings but not in "add" list */
const EXTRA_TYPES = {
  status: { label: 'Статус', Icon: CircleDot },
  tags: { label: 'Тэги', Icon: Tag },
  source: { label: 'Источник', Icon: Compass },
  comments: { label: 'Комментарии', Icon: MessageSquare },
};

/**
 * @param {string} type
 * @param {string} [key] title key uses Type icon
 */
export function getFieldTypeMeta(type, key) {
  if (key === 'title') {
    return { label: 'Название', Icon: Type };
  }
  const add = ADDABLE_FIELD_TYPES.find((t) => t.value === type);
  if (add) return { label: add.label, Icon: add.Icon };
  const ex = EXTRA_TYPES[/** @type {keyof typeof EXTRA_TYPES} */ (type)];
  if (ex) return ex;
  return { label: type, Icon: AlignLeft };
}
