// app/rides/new/page.tsx
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
import { Textarea } from "@/components/ui/textarea";
import { createRide } from "@/lib/api";
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
  departure_at: z.string().min(1, "Pick a date and time"),
  total_seats: z.coerce.number().min(1).max(8),
  price_per_seat: z.coerce.number().min(0),
  notes: z.string().optional(),
  is_recurring: z.boolean(),
});

type FormData = {
  departure_at: string;
  total_seats: number;
  price_per_seat: number;
  notes?: string;
  is_recurring: boolean;
};

export default function NewRidePage() {
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
    defaultValues: {
      total_seats: 1,
      price_per_seat: 0,
      is_recurring: false,
    },
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
      const iso = new Date(data.departure_at).toISOString();
      const res = await createRide({
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        origin_label: origin.label,
        dest_lat: destination.lat,
        dest_lng: destination.lng,
        dest_label: destination.label,
        departure_at: iso,
        total_seats: data.total_seats,
        price_per_seat: data.price_per_seat,
        is_recurring: data.is_recurring,
        recurrence_days: data.is_recurring ? recurDays : [],
        notes: data.notes,
      });
      toast.success("Ride posted!");
      router.push(`/rides/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to post ride");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) return null

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Offer a ride</h1>
        <p className="text-slate-500 text-sm mt-1">
          Click your pickup point then destination on the map
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* map */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Route</h2>
          <MapPicker
            onChange={(o, d) => {
              setOrigin(o);
              setDestination(d);
            }}
            height="320px"
          />
        </div>

        {/* trip details */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Trip details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <Label className="text-sm mb-1 block">
                Departure date and time
              </Label>
              <Input type="datetime-local" {...register("departure_at")} />
              {errors.departure_at && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.departure_at.message}
                </p>
              )}
            </div>

            <div>
              <Label className="text-sm mb-1 block">Available seats</Label>
              <Input
                type="number"
                min={1}
                max={8}
                {...register("total_seats")}
              />
              {errors.total_seats && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.total_seats.message}
                </p>
              )}
            </div>

            <div>
              <Label className="text-sm mb-1 block">Price per seat (₹)</Label>
              <Input
                type="number"
                min={0}
                placeholder="0 for free"
                {...register("price_per_seat")}
              />
              {errors.price_per_seat && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.price_per_seat.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* recurring */}
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-slate-900">Recurring ride</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically repost this ride on selected days
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

        {/* notes */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-3">
            Notes{" "}
            <span className="text-slate-400 font-normal text-sm">
              (optional)
            </span>
          </h2>
          <Textarea
            placeholder="AC car, no smoking, one stop allowed..."
            className="resize-none"
            rows={3}
            {...register("notes")}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Posting ride..." : "Post ride"}
        </Button>
      </form>
    </div>
  );
}
