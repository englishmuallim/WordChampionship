begin;

drop function public.wc_ranking(uuid, smallint, text, boolean);

create function public.wc_ranking(
  p_season_id uuid,
  p_grade smallint,
  p_class_name text default null,
  p_include_left boolean default false
) returns table (
  student_id uuid,
  student_no varchar,
  full_name varchar,
  grade smallint,
  class_name varchar,
  is_active boolean,
  exams_taken integer,
  total_points integer,
  grade_rank integer,
  class_rank integer,
  kopya_sayisi integer
)
language sql stable security definer set search_path = '' as $$
  with base as (
    select s.id, s.student_no, s.full_name, s.grade, s.class_name, s.is_active
    from public.students s
    where public.wc_is_staff()
      and public.wc_season_in_my_school(p_season_id)
      and s.school_id = public.wc_my_school_id()
      and s.grade = p_grade
      and (s.is_active or p_include_left)
  ),
  pts as (
    select sc.student_id,
           count(*) filter (where sc.status = 'girdi') as exams_taken,
           sum(sc.correct_count * e.points_per_question) filter (where sc.status = 'girdi') as total,
           count(*) filter (where sc.status = 'kopya') as kopya_sayisi
    from public.wc_exam_scores sc
    join public.wc_exams e on e.id = sc.exam_id
    where e.season_id = p_season_id
      and sc.status in ('girdi', 'kopya')
    group by sc.student_id
  ),
  ranked as (
    select b.id, b.student_no, b.full_name, b.grade, b.class_name, b.is_active,
           coalesce(p.exams_taken, 0)::integer as exams_taken,
           coalesce(p.total, 0)::integer as total_points,
           coalesce(p.kopya_sayisi, 0)::integer as kopya_sayisi,
           (rank() over (order by coalesce(p.total, 0) desc))::integer as grade_rank,
           (rank() over (partition by b.class_name order by coalesce(p.total, 0) desc))::integer as class_rank
    from base b
    left join pts p on p.student_id = b.id
  )
  select r.id, r.student_no, r.full_name, r.grade, r.class_name, r.is_active,
         r.exams_taken, r.total_points, r.grade_rank, r.class_rank, r.kopya_sayisi
  from ranked r
  where p_class_name is null or r.class_name = p_class_name
  order by r.grade_rank, r.class_name, r.full_name;
$$;

revoke execute on function public.wc_ranking(uuid, smallint, text, boolean) from public, anon;

grant execute on function public.wc_ranking(uuid, smallint, text, boolean) to authenticated;

commit;
