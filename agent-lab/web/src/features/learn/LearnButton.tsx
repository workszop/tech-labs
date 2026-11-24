/** Header button that opens the Learn dialog (mounted here, once). */
import { GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { useT } from '@/i18n'
import { openLearn } from './bus'
import { LearnDialog } from './LearnDialog'

export function LearnButton() {
  const tx = useT().learn
  return (
    <>
      <Tooltip content={tx.buttonHint}>
        <Button variant="outline" size="sm" className="px-2.5 lg:px-3" onClick={() => openLearn()} aria-label={tx.button} data-testid="learn-button">
          <GraduationCap /> <span className="hidden lg:inline">{tx.button}</span>
        </Button>
      </Tooltip>
      <LearnDialog />
    </>
  )
}
