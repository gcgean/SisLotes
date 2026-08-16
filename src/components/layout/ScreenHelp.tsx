import { CircleHelp, ExternalLink, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScreenTutorial } from "@/lib/screen-tutorials";

interface ScreenHelpProps {
  tutorial: ScreenTutorial;
}

export function ScreenHelp({ tutorial }: ScreenHelpProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title={`Ajuda: ${tutorial.title}`} aria-label={`Abrir tutorial: ${tutorial.title}`}>
          <CircleHelp className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <CircleHelp className="h-5 w-5" />
            <DialogTitle>Tutorial — {tutorial.title}</DialogTitle>
          </div>
          <DialogDescription>{tutorial.summary}</DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Como usar</h3>
          <ol className="space-y-3">
            {tutorial.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {tutorial.tips?.length ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Antes de continuar</h3>
            {tutorial.tips.map((tip) => <p key={tip} className="mt-1 text-sm text-amber-800 dark:text-amber-300">{tip}</p>)}
          </section>
        ) : null}

        <section className="rounded-lg border border-dashed p-4">
          <div className="flex items-start gap-3">
            <PlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">Tutorial em vídeo</h3>
              {tutorial.videoUrl ? (
                <Button asChild variant="link" className="h-auto p-0 text-sm">
                  <a href={tutorial.videoUrl} target="_blank" rel="noopener noreferrer">Assistir ao vídeo <ExternalLink className="ml-1 h-3.5 w-3.5" /></a>
                </Button>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Vídeo ainda não cadastrado. O link poderá ser incluído no catálogo de tutoriais.</p>
              )}
            </div>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
