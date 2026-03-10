export type InternalColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => string | number;
};

export function InternalTable<T>({
  title,
  columns,
  rows,
  emptyLabel = "No data"
}: {
  title: string;
  columns: InternalColumn<T>[];
  rows: T[];
  emptyLabel?: string;
}) {
  return (
    <section className="detail-section internal-section">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">{emptyLabel}</p>
      ) : (
        <div className="internal-table-wrap">
          <table className="internal-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {columns.map((column) => (
                    <td key={`${title}-${index}-${column.key}`}>{column.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
