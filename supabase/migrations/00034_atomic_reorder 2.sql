-- Atomic task reordering: updates all sort_orders in a single transaction.
-- Prevents data corruption when individual updates fail mid-loop.

CREATE OR REPLACE FUNCTION reorder_tasks(task_ids uuid[], new_orders int[])
RETURNS void AS $$
BEGIN
  IF array_length(task_ids, 1) != array_length(new_orders, 1) THEN
    RAISE EXCEPTION 'task_ids and new_orders must have the same length';
  END IF;

  UPDATE tasks
  SET sort_order = t.new_order, updated_at = now()
  FROM (
    SELECT unnest(task_ids) AS id, unnest(new_orders) AS new_order
  ) AS t
  WHERE tasks.id = t.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
