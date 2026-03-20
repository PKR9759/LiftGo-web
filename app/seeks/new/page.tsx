// app/seeks/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSeek } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { toast } from "sonner";
import type { LatLng } from "@/types";

const MapPicker = dynamic(() => import("@/components/map/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-80 rounded-xl border bg-slate-100 animate-pulse" />
  ),
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const schema = z.object({
  seats_needed: z.coerce.number().min(1).max(8),
  is_recurring: z.boolean(),
});

type FormData = {
  seats_needed: number;
  is_recurring: boolean;
};

export default function NewSeekPage() {
  const { ready } = useRequireAuth()
  const router = useRouter();

  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [recurDays, setRecurDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { seats_needed: 1, is_recurring: false },
  });

  const isRecurring = watch("is_recurring");

  const toggleDay = (day: number) => {
    setRecurDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const onSubmit = async (data: FormData) => {
    if (!origin) {
      toast.error("Please set your pickup point on the map");
      return;
    }
    if (!destination) {
      toast.error("Please set your destination on the map");
      return;
    }
    if (data.is_recurring && recurDays.length === 0) {
      toast.error("Select at least one recurring day");
      return;
    }

    setLoading(true);
    try {
      await createSeek({
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        origin_label: origin.label,
        dest_lat: destination.lat,
        dest_lng: destination.lng,
        dest_label: destination.label,
        seats_needed: data.seats_needed,
        is_recurring: data.is_recurring,
        recurrence_days: data.is_recurring ? recurDays : [],
      });
      toast.success("Seek posted! Drivers near your route will see it.");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to post seek");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) return null

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Need a ride?</h1>
        <p className="text-slate-500 text-sm mt-1">
          Click your pickup point then destination — drivers going your way will
          find you
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* map */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Your route</h2>
          <MapPicker
            onChange={(o, d) => {
              setOrigin(o);
              setDestination(d);
            }}
            height="320px"
          />
        </div>

        {/* seats */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Details</h2>
          <div className="max-w-xs">
            <Label className="text-sm mb-1 block">Seats needed</Label>
            <Input
              type="number"
              min={1}
              max={8}
              {...register("seats_needed")}
            />
            {errors.seats_needed && (
              <p className="text-red-500 text-xs mt-1">
                {errors.seats_needed.message}
              </p>
            )}
          </div>
        </div>

        {/* recurring */}
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-slate-900">Daily commute</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Repost this seek automatically on selected days
              </p>
            </div>
            <label className="relative cursor-pointer">
              <input
                type="checkbox"
                {...register("is_recurring")}
                className="peer sr-only"
              />
              <div
                className="w-10 h-6 bg-slate-200 rounded-full
                peer-checked:bg-slate-900 transition-colors"
              />
              <div
                className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full
                transition-transform peer-checked:translate-x-4 shadow-sm"
              />
            </label>
          </div>

          {isRecurring && (
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${recurDays.includes(i)
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                    }`}
                >
                  {day}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* info box */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-blue-700 text-sm">
            Your seek stays active for 2 hours. Drivers whose route passes near
            yours will see you on the live board.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Posting..." : "Post seek"}
        </Button>
      </form>
    </div>
  );
}
