export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="font-medium text-gray-800 mb-1">{title}</p>
      {description && (
        <p className="text-sm text-gray-500 mb-4">{description}</p>
      )}
      {action}
    </div>
  )
}
